const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../src/bottom-navigation.js');

test('bottom navigation exposes short thumb-friendly labels', () => {
  assert.equal(nav.navLabel('explore'), '近所');
  assert.equal(nav.navLabel('home'), '拠点');
  assert.equal(nav.navLabel('gear'), '装備');
});

test('expedition page loads bottom navigation assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'expedition.html'), 'utf8');
  assert.match(html, /bottom-navigation\.css/);
  assert.match(html, /src\/bottom-navigation\.js/);
});

test('bottom navigation is fixed and reserves iOS safe area', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'bottom-navigation.css'), 'utf8');
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /min-height:\s*46px/);
  assert.match(css, /flex:\s*1 1 0/);
  assert.match(css, /border-radius:\s*2px/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*body:has\(\.bottom-navigation\)/);
  assert.match(css, /padding-bottom:/);
});


test('desktop living-map preview anchors the dock inside the phone frame', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'living-map-home.css'), 'utf8');
  assert.match(css, />\.camp-tabs\.bottom-navigation\{position:absolute/);
  assert.match(css, /atlas-home-caption\{display:none\}/);
});

test('sumi-e dock has equal columns even before its optional JS enhancer', () => {
  const app = fs.readFileSync(path.join(__dirname,'..','src','slice-app.js'),'utf8');
  const css = fs.readFileSync(path.join(__dirname,'..','neighborhood.css'),'utf8');
  assert.match(app,/class="camp-tabs bottom-navigation"/);
  assert.match(css,/grid-template-columns:none;grid-auto-flow:column/);
  assert.match(css,/grid-auto-columns:minmax\(0,1fr\)/);
  assert.match(css,/>button\{\s*\n  display:flex/);
  assert.match(css,/min-width:0;min-height:48px/);
});


test('Codex and Chronicle injection results in six equal-ready dock items on one row', () => {
  const vm = require('node:vm');
  const classes = value => {
    const values = new Set(value.split(' ').filter(Boolean));
    return {
      values,
      add(name) { values.add(name); },
      remove(name) { values.delete(name); },
      contains(name) { return values.has(name); },
    };
  };
  const item = (text, active = false) => ({
    textContent: text, dataset: {}, classList: classes('bottom-navigation-item'+(active ? ' active' : '')),
    attributes: { 'aria-current': active ? 'page' : 'false' },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(event, fn) { this[event] = fn; },
  });
  const initial = ['近所','拠点','装備','設定'].map((x, i) => item(x,i===0));
  initial[3].dataset.action='settings';
  const nav = {
    children:initial,
    querySelector(selector) {
      if(selector === '[data-action="settings"]') return this.children.find(x=>x.dataset.action==='settings') || null;
      if(selector === '[data-codex-tab]') return this.children.find(x=>x.dataset.codexTab) || null;
      if(selector === '[data-chronicle-tab]') return this.children.find(x=>x.dataset.chronicleTab) || null;
      return null;
    },
    querySelectorAll(selector) { return selector==='button' ? this.children : []; },
    insertBefore(element, before) {
      const index=this.children.indexOf(before);
      this.children.splice(index<0 ? this.children.length : index,0,element);
    },
    appendChild(element) { this.children.push(element); },
    after(element) { this.parentElement.children.push(element); },
  };
  const parent = { children:[nav] };
  nav.parentElement=parent;
  const game = { querySelector(selector) { return selector==='.camp-tabs' ? nav : null; } };
  const document = {
    readyState:'complete',
    querySelector(selector) { return selector==='#game' ? game : null; },
    createElement(tag) {
      const el=item('');
      el.tagName=tag; el.querySelectorAll=()=>[]; el.matches=()=>false;
      el.remove=()=>{ const index=parent.children.indexOf(el); if(index>=0) parent.children.splice(index,1); };
      return el;
    },
  };
  const context = {
    document,
    localStorage:{ getItem(){return null;},setItem(){} },
    CrownlessSlice:{parse(){return null;}},
    MutationObserver:class { observe(){} },
  };
  context.window=context;
  for(const file of ['src/codex-ui.js','src/travel-chronicle-ui.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  }
  assert.deepEqual(nav.children.map(x=>x.textContent),
    ['近所','拠点','装備','手記','冒険録','設定']);
  assert.equal(nav.children.length,6);
  for(const x of nav.children) {
    assert.ok(x.classList.contains('bottom-navigation-item'),x.textContent);
  }
  nav.children[3].click();
  assert.deepEqual(nav.children.filter(x=>x.attributes['aria-current']==='page').map(x=>x.textContent),['手記']);
  nav.children[4].click();
  assert.deepEqual(nav.children.filter(x=>x.attributes['aria-current']==='page').map(x=>x.textContent),['冒険録']);
});
