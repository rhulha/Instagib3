function updateFragsCounter(frags) {
    document.getElementById("frags").innerText = "" + frags + " frags";
}

function updateTopFragsCounter(playerWithMostFrags) {
    document.getElementById("topfrags").innerText = "top: " + playerWithMostFrags.name + " " + playerWithMostFrags.frags;
}

function updateInfoText(text) {
    document.getElementById("info").innerText = text;
}

function hideGunAndCrosshairs() {
    document.getElementById("gun").style.visibility = "hidden";
    document.getElementById("crosshair").style.visibility = "hidden";
    document.getElementById("frags").style.visibility = "hidden";
    document.getElementById("topfrags").style.visibility = "hidden";
}

function showGunAndCrosshairs() {
    document.getElementById("gun").style.visibility = "visible";
    document.getElementById("crosshair").style.visibility = "visible";
    document.getElementById("frags").style.visibility = "visible";
    document.getElementById("topfrags").style.visibility = "visible";
}

export {updateInfoText, updateFragsCounter, updateTopFragsCounter, hideGunAndCrosshairs, showGunAndCrosshairs};
