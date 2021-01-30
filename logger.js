FgGreen = "\x1b[32m"
FgYellow = "\x1b[33m"
Reset = "\x1b[0m"
FgMagenta = "\x1b[35m"

const fs = require('fs')

function info(message){
    console.log(`${FgGreen}${message}${Reset}`)
}

function warn(message){
    console.log(`${FgYellow}${message}${Reset}`)
}

function logAuctionResult(auction){
    const log = `Action ${auction.name} is being removed with price ${auction.price}, won: ${auction.winning}\n`
    console.log(`${FgMagenta}${log}${Reset}`)
    fs.writeFileSync('auction_results.log', log)
}

exports.auction = logAuctionResult
exports.info = info
exports.warn = warn