const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../src/expedition-field.js');

test('lantern shortcut needs clue and deliberate investigation before movement',()=>{
  let f=F.initial();
  f={...f,pos:F.CACHE,seen:F.initial().seen+2**F.CACHE};
  // The player must first actually reach the cache; a saved valid field
  // can be constructed from the same exploration visibility rule.
  assert.equal(F.valid(f),true);
  assert.equal(F.canMove(f,F.LANTERN_PASS),false);
  assert.equal(F.uncoverLanternPassage(f,F.LANTERN_PASS),null);
  f={...f,lanternClue:true};
  const opened=F.uncoverLanternPassage(f,F.LANTERN_PASS);
  assert.ok(opened);
  assert.equal(opened.pos,F.CACHE);
  assert.equal(F.canMove(opened,F.LANTERN_PASS),true);
  const stepped=F.move(opened,F.LANTERN_PASS);
  assert.equal(stepped.pos,F.LANTERN_PASS);
  assert.equal(F.canMove(stepped,10),true);
  assert.equal(F.canMove(stepped,F.SECRET),false);
  assert.equal(F.valid(JSON.parse(JSON.stringify(stepped))),true);
});

test('shortcut is not exposed from a nonadjacent tile or without lamp clue',()=>{
  const f=F.initial();
  assert.equal(F.uncoverLanternPassage({...f,lanternClue:true},F.LANTERN_PASS),null);
  assert.equal(F.visible(f,F.LANTERN_PASS),false);
});
