const updateInputsForResource = require("./updateInputsForResource")
    .updateInputsForResource;

const papli = new updateInputsForResource("foo", "bar");

test("updateInputsForResource", () => {
    expect(papli.doThing).toBe("foobar");
});
