const database = require("./database")
const scrapper = require("./scrapping/scrap")
const scheduler = require("node-schedule")
const logger = require('./logger')
const ONE_SECOND = 1000;
const SIXTY_SECONDS = ONE_SECOND * 60;
const FIFTEEN_SECONDS = 15;
exports.hasJobs = function(){
    return true;
}


async function initiate(){
    await scrapper.getAllAuctions(database.auctions)
    await createAuctionCronjobs()
    createDefaultCronjobs()
}

async function createAuctionCronjobs(){
    const markedForDeletion = []
    for(const auction of database.auctions){
        if(!auction.cronjob){
            if(!auctionPriceAboveThreshold(auction))
                await createJob(auction)
            else
                markedForDeletion.push(auction)
        }
    }
    markedForDeletion.forEach(deleteAuction)
}

function deleteAuction(auction){
    checkResults(auction)
    logger.warn(`removing ${auction.name} since it's price is too high max price was ${auction.maxPrice}`)
    database.remove(auction);
    scrapper.unfav(auction);
}

function auctionPriceAboveThreshold(auction){
    return auction.nextBid >= auction.maxPrice
}

function createDefaultCronjobs(){
    createListCronjob();
    createlogCronjob();
    createPriceUpdateJob();
}

function createlogCronjob(){
    scheduler.scheduleJob(`*/${process.env.minutesReport} * * * *`, function(date){
        const winning = database.auctions.filter(item => item.winning)
        const totalPrice = database.auctions? database.auctions.map(item => item.nextBid).reduce((previous, current)=> previous+current): 0.0
        logger.info(`PERIODIC REPORT: WE HAVE ${database.auctions.length} WINNING ${winning.length} OF THEM. TOTAL PRICE: ${totalPrice}`)
    })
}

async function createListCronjob(){

    scheduler.scheduleJob(`*/${process.env.minutesAuctionScan} * * * *`, function(date){
        logger.info(`running job to update favorite list: ${date}`);
        scrapper.getAllAuctions(database.auctions).then(createAuctionCronjobs)
    });

}

async function createPriceUpdateJob(){

    scheduler.scheduleJob(`*/${process.env.priceUpdateMinutes} * * * *`, function(date){
        logger.info(`running job to update favorite list: ${date}`);
        updateAuctions()
    });

}

async function updateAuctions(){
    const markedForDeletion = []
    database.auctions.forEach(
        async auction => {
        if(!auctionPriceAboveThreshold(auction))
            await scrapper.getPricingData(auction);
        else
            markedForDeletion.push(auction)
        }
    )
    markedForDeletion.forEach(deleteAuction)
}

async function createJob(auction){
    let triggerDate;
    if(!auction.cronjob){
        triggerDate = new Date(auction.endDate - SIXTY_SECONDS);
    }
    else{
        triggerDate = new Date()
        triggerDate.setSeconds(triggerDate.getSeconds()+ FIFTEEN_SECONDS)
        logger.warn(`ENTERING ATTACK MODE FOR ${auction.name}`)
    }
    const job = scheduler.scheduleJob(triggerDate, async () => await scheduleBid(auction.id));    
    logger.info(`\nscheduled job for auction ${auction.name} for ${job.nextInvocation()}`)
    logger.info(`the maximum threshold for biding is ${auction.maxPrice} and the next bid value is ${auction.nextBid}`  )
    auction.cronjob = job;
}

async function scheduleBid(auctionId) {
    const auction = database.getAuctionById(auctionId)
    await scrapper.getPricingData(auction);
    if((auction.nextBid < auction.maxPrice) && !auction.winning){
            await scrapper.bid(auction)
            await scrapper.getPricingData(auction);

    }
    if(auctionPriceAboveThreshold(auction) || (new Date() >= auction.endDate)){
        checkResults(auction);
        deleteAuction(auction);
    }
    else
        createJob(auction)

}

function checkResults(auction){
    logger.auction(auction);
}

exports.initiate = initiate