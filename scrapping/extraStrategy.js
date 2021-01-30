function containsAllExtras(element, extras){

    return extras.every(extra => containsExtra(element, extra))
    
}

function removeUselessExtras(extras){
    if(extras.includes("Foil") && extras.includes("Promo"))
        extras = extras.filter(item => item != "Foil")
}

function containsExtra(element, extra){
    const textForExtra = getTextForExtra(extra)
    return element.innerHTML.includes(textForExtra)
}


function getTextForExtra(extra){
    switch (extra) {
        case "Foil":
            return "<font color=\"red\"><b>Foil</b></font>"
        case "Foil Etched":
            return "Foil Etched"
        default:
            break;
    }

}

exports.containsAllExtras = containsAllExtras
exports.removeUselessExtras = removeUselessExtras