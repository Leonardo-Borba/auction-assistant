const { JSDOM, VirtualConsole } = require("jsdom");
const database = require('../database')
const connectionService = require("../connectionService");
const pdpScrapper = require("./pdpPriceScrapper")
const rootPage = "https://www.ligamagic.com.br";
const logger = require('../logger')
let myAuctionsPage =
  "https://www.ligamagic.com.br/?view=leilao/painel&txt_sts_ativo=1&txt_painel=1&hide=1";

async function getEditionPriceFromPage(url, edition, extras) {
  const body = await connectionService.axios.get(url);
  const priceString = await pdpScrapper.getBestPriceForCard(new JSDOM(body.data), edition, extras)
  return convertCurrencyToNumber(priceString);
}

async function getAllAuctions(activeAuctions) {
  const body = await connectionService.axios.get(myAuctionsPage);
  const dom = new JSDOM(body.data, {
    runScripts: "dangerously",
    virtualConsole: new VirtualConsole(),
  });
  const auctions = dom.window.document.querySelectorAll("tr#llx");

  const auctionObjsArr = createBasicAuctions(auctions, activeAuctions);
  await addPricingData(auctionObjsArr);
  activeAuctions.push(...auctionObjsArr);
}

//private
async function addPricingData(auctionObjsArr) {
  let promises = [];
  for (const auction of auctionObjsArr) {
    let promise = new Promise(async (resolve, reject) => {
      try {
        await getPricingDataFor(auction);
      } catch (e) {
        reject(e);
      }
      resolve();
    });
    promises.push(promise);
  }
  if (promises.length > 0)
    logger.info("requests created, waiting for promises to resolve");
  else logger.info("no new auctions were found");
  await Promise.all(promises);
}
async function getAuctionPage(auction) {
  return (await connectionService.axios.get(auction.auctionLink)).data;
}

//private
function parseEndDate(auctionPage) {
  const dateTxt = auctionPage.window.document.querySelector(
    ".box-interna .lista-infos .b"
  ).innerHTML;
  return parseDate(dateTxt);
}

async function getPricingDataFor(auction) {
  logger.info(`getting price data for ${auction.name}`);
  let auctionPage = await getAuctionPage(auction);
  auctionPage = new JSDOM(auctionPage);
  try{
  auction.cardLink = auctionPage.window.document.querySelector(
    ".double a"
  ).href;
  } catch(e){
    console.log(auction)
  }
  auction.price = parsePrice(auctionPage.window.document, "h3.lj.b");
  auction.nextBid = parsePrice(auctionPage.window.document, "[name=meuLance]");
  auction.cardLink = rootPage + auction.cardLink.substr(1);
  auction.cardVersion = auction.cardLink.split("=").slice(-1).pop();
  auction.foil = auctionPage.window.document.querySelector(".tabela-interna.sem-borda td:last-child").innerHTML.toLowerCase().includes("foil");
  auction.extras = getExtras(auctionPage)
  auction.winning = auctionPage.window.document
    .querySelector("a.laranjaP")
    .innerHTML.includes(process.env.user);
  auction.endDate = parseEndDate(auctionPage);
  auction.maxPrice =
    (await getEditionPriceFromPage(auction.cardLink, auction.cardVersion, auction.extras)) *
    Number(process.env.pricePercentage);
    logger.info(
    `finished gathering data for ${auction.name} waiting for all promises to resolve`
  );
}

function getExtras(auctionPage){
  const extras = auctionPage.window.document.querySelector(".tabela-interna.sem-borda ").querySelector("td:last-child p").innerHTML.split(", ").filter(entry => entry != "")
  return extras.length ? extras : []
}

//private
function createBasicAuctions(auctions, activeAuctions) {
  const auctionObjs = [];
  const ids = []
  auctions.forEach((auction) => {
    const auctionId = `https:${auction.querySelector("a.preto").href}`.match(
      /\d{2,10}/i
    )[0];
    ids.push(auctionId)
    const auctionName = auction.querySelector(".preto").innerHTML.trim();
    if (!alreadyExists(auctionId, activeAuctions) && !ended(auction))
      auctionObjs.push({
        name: auctionName,
        auctionLink: `https:${auction.querySelector("a.preto").href}`,
        id: auctionId,
      });
    if (ended(auction)) {
      unfav({"id":auctionId});
    }
  });
  removeUnfavoritedActions(ids)
  return auctionObjs;
}

function removeUnfavoritedActions(idsArray){
  const markedForRemoval = []
  database.auctions.forEach((item) => { if(!idsArray.includes(item.id)) markedForRemoval.push(item) })
  markedForRemoval.forEach(item => {
    logger.warn(`Removing ${item.name} from the database, since it's not in the favorites list anymore`)
    database.remove(item)
  })
}

function ended(auction) {
  try {
    const auctionDate = parseDate(
      auction.querySelector("#changeLineCss_7").innerHTML
    );
    return new Date() > auctionDate;
  } catch (e) {
    return false;
  }
  return false;
}

function parseDate(dateText) {
  let dateArray = dateText
    .match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/i)[0]
    .split(" ");
  const date = dateArray[0].split("/").reverse().join("/");
  return new Date(`${date} ${dateArray[1]}`);
}

function parsePrice(body, selector) {
  const element = body.querySelector(selector);
  let text;
  if (element.tagName === "INPUT") text = element.value;
  else text = element.innerHTML;
  return convertCurrencyToNumber(text)
}
function convertToNumber(value) {
  return Number(value.replace(",", "."));
}

function convertCurrencyToNumber(text){
  return convertToNumber(text.match(/\d{1,4},\d{2}/i)[0]);
}

async function unfav(auction) {
  logger.warn(`removing ${auction.id} from favorites`);
  await connectionService.axios.post(rootPage + "/ajax/leilao/favorito.php", {
    id: Number(auction.id),
    funcao: 0,
    exibeLabel: 1,
    icon: "star",
  });
}

async function bid(auction) {
  logger.info(`Bidding in auction ${auction.name} for ${auction.nextBid}`)
  await connectionService.axios.post(
    `${rootPage}/?view=leilao/darlance&id=${auction.id}`,
    {
      precoMin: String(auction.nextBid),
      meuLance: Number(auction.nextBid).toFixed(2),
      isConfirm: "ok",
      darLance: "Confirmo+meu+Lance"
    }
  );
}

//private
function alreadyExists(auctionId, auctionsArray) {
  return auctionsArray.some((auction) => auction.id === auctionId);
}


exports.bid = bid;
exports.unfav = unfav;
exports.getPricingData = getPricingDataFor;
exports.getAuctionPage = getAuctionPage;
exports.getAllAuctions = getAllAuctions;
exports.getEditionPriceFromPage = getEditionPriceFromPage;
