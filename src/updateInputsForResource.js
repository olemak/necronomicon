class updateInputsForResource {
    constructor(hey, ho) {
        this.hey = hey;
        this.ho = ho;
    }
    get doThing() {
        return this.hey + this.ho;
    }
}

module.exports = { updateInputsForResource };
