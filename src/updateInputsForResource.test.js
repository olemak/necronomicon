const updateInputsForResource = require("./updateInputsForResource");

const papli = new updateInputsForResource("foo", "baaar");

test ("updateInputsForResource", ()=> {
    expect(papli.doThing).toBe("boooblidoo");
})