const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
class Sheet {
  constructor(name, data = []) { this.name = name; this.data = data; }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(0,...this.data.map(r => r.length)); }
  getRange(row,col,height = 1,width = 1) {
    return {
      getValues: () => Array.from({length:height}, (_,i) => Array.from({length:width}, (_,j) => this.data[row+i-1]?.[col+j-1] ?? '')),
      setValues: values => { values.forEach((r,i) => { this.data[row+i-1] ||= []; r.forEach((v,j) => { this.data[row+i-1][col+j-1] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }); }); },
      setNumberFormat: () => {}
    };
  }
  getDataRange() { return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn())); }
  appendRow(row) { this.getRange(this.data.length+1,1,1,row.length).setValues([row]); }
  deleteRow(index) { this.data.splice(index-1,1); }
  setFrozenRows() {}
  copyTo(ss) { const copy = new Sheet('Copy ' + this.name, structuredClone(this.data)); ss.sheets.push(copy); return copy; }
  setName(name) { this.name = name; return this; }
}
function createHarness() {
  const ss = {sheets:[],getSheetByName(name) { return this.sheets.find(s => s.name === name); },insertSheet(name) { const s = new Sheet(name); this.sheets.push(s); return s; }};
  const cache = new Map(), properties = new Map(); let held = false;
  const context = vm.createContext({ Date, Set, Map, JSON, Array, String, Number, Error,
    SpreadsheetApp: {openById:() => ss, flush:() => {}},
    Utilities: {getUuid:randomUUID,formatDate:() => '20261029-120000'},
    LockService: {getScriptLock:() => ({tryLock:() => { if (held) return false; held = true; return true; },releaseLock:() => { held = false; }})},
    CacheService: {getScriptCache:() => ({get:k => cache.get(k),put:(k,v) => cache.set(k,v),remove:k => cache.delete(k)})},
    PropertiesService: {getScriptProperties:() => ({getProperty:k => properties.get(k) ?? null})},
    ContentService: {MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:body => ({body,setMimeType(type) { this.type = type; return this; }})}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),context);
  return {context, ss, cache, properties, holdLock(value) { held = value; }, setup:() => context.setupDatabase(),
    post:p => JSON.parse(context.doPost({postData:{contents:JSON.stringify(p)}}).body),
    get:(p={}) => context.doGet({parameter:p})};
}
module.exports = {createHarness, Sheet};
