const axios = require("../connectionService").axios
const { JSDOM } = require("jsdom");
const unwanted = JSON.parse(process.env.unwanted)
const banList = JSON.parse(process.env.banList)
const extraStrategy = require('./extraStrategy')
async function getBestPriceForCard(dom, edition, extras){
    extraStrategy.removeUselessExtras(extras)
    const cheapestStorePdp = getCheapestOptionURL(dom, edition, extras)
    return await getPriceFromCheapestStore(cheapestStorePdp, edition, extras)
}

function getCheapestOptionURL(dom, edition, extras){
    const availableOptions = [...dom.window.document.querySelectorAll("#aba-cards>.estoque-linha")]
    let rightEdition = availableOptions.filter(item => item.querySelector(".ed-simb") && 
        item.querySelector(".ed-simb").href.endsWith(`=${edition}`))
    if(extras.length)
      rightEdition = filterExtras(rightEdition, extras)
    rightEdition = removeUnwantedQualityGrades(rightEdition)
    rightEdition = removeStoresFromBanlist(rightEdition)
    const url = "https://www.ligamagic.com.br/" +rightEdition[0].querySelector(".goto").href
    const selectedGrade =  rightEdition[0].querySelector(".e-col4>font").innerHTML
    return {url, selectedGrade}
}

function removeStoresFromBanlist(rightEdition){
    return rightEdition.filter(item => {
        const img = item.querySelector(".e-col1 img").title;
        return !banList.some(store => img.includes(store))
    })
}

function filterExtras(rightEdition, extras){
    return rightEdition.filter(
        item => item.querySelector("p.extras") 
        && extras.every(
            extra => item.querySelector("p.extras").innerHTML.split(", ").includes(extra)
            )
        )
}

function removeUnwantedQualityGrades(rightEdition){
    return rightEdition.filter(item => 
        {
            const quality = item.querySelector(".e-col4>font")
            return !unwanted.some(qlty =>
                quality && quality.innerHTML.includes(qlty)) 
        })
}

async function getPriceFromCheapestStore(cheapestStorePdp, edition, extras){
    const page = await(axios.get(cheapestStorePdp.url))
    const dom = new JSDOM(page.data)
    let options = [...dom.window.document.querySelectorAll(".itemMain table table:last-child tbody tr")].slice(1)
    options = options.filter(item => filterFoils(item, extras)).filter(filterOutOfStock)
    const selected = options.filter(item => 
        item.querySelector(".very2Small") &&
        item.querySelector(".very2Small").innerHTML.includes(cheapestStorePdp.selectedGrade)
        && item.querySelector("img").src.toLowerCase().includes(`/${edition.toLowerCase()}_`))[0]
    if(selected.querySelector(".itemPreco").childElementCount > 0)
        return selected.querySelector(".itemPreco").lastElementChild.innerHTML
    else
        return selected.querySelector(".itemPreco").innerHTML
}

function filterOutOfStock(item){
    return item.querySelector(".hmin30:nth-child(5)").innerHTML !== "0 unid.";
}

function filterFoils(item, extras){
    const inner = (auction) => {
        return auction.querySelector(".hmin30:nth-child(4)")
            && extraStrategy.containsAllExtras(auction.querySelector(".hmin30:nth-child(4)"), extras)
    }

    return extras ? inner(item) : !inner(item)

}



exports.getBestPriceForCard = getBestPriceForCard;