var audioHolder = {};

audioHolder.play = function(name, volume) {
    volume = volume || this[name].defaultVolume;
    this[name].volume = volume * this.volume;
    this[name].play();
}

function getSound(propName, fileName) {
    audioHolder[propName] = new Audio('sounds/' + fileName + '.mp3');
}

function initializeAudio() {
    getSound("railgun", "railgf1a");
    getSound("railgun_enemy", "railgf1a");
    getSound("jump", "sarge/jump1");
    getSound("jumppad", "jumppad");
    getSound("gib", "gibsplt1");
    getSound("teleport", "telein");
    getSound("pickup", "holdable");
    audioHolder.railgun.defaultVolume = 0.1;
    audioHolder.railgun_enemy.defaultVolume = 0.08;
    audioHolder.jump.defaultVolume = 0.2;
    audioHolder.jumppad.defaultVolume = 0.5;
    audioHolder.gib.defaultVolume = 0.3;
    audioHolder.teleport.defaultVolume = 0.4;
    audioHolder.pickup.defaultVolume = 0.4;
    audioHolder.volume = 0.2;
}

export {audioHolder, initializeAudio};
