const activeAuctions = []

function remove(auction){
    if(auction.cronjob)
        auction.cronjob.cancel()
    const index = activeAuctions.indexOf(auction)
    activeAuctions.splice(index, 1)
}

function getAuctionById(id){
    return activeAuctions.find(item => item.id === id)
}


exports.remove = remove;
exports.getAuctionById = getAuctionById
exports.auctions = activeAuctions
