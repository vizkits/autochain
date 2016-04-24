var wire = require("js-wire");
var tmsp = require("js-tmsp");
var util = require("util");
var merkle = require('merkle');
var eyes = require("js-merkleeyes");

function AutoApp(){
  this.txs = [];
  this.tree = null;
  this.hashCount = 0;

  // TODO: move to app state/db
  this.balance = {"0000":50, "1111":50, "2222":0};
};

AutoApp.prototype.info = function(req, cb) {
  console.log('auto: info');
  return cb({
    data: util.format("hashes:%d, txs:%d", this.hashCount, this.txs.length),
  });
}

AutoApp.prototype.setOption = function(req, cb) {
  console.log('auto: set option');
  return cb({code:tmsp.CodeType_OK, log:"SetOption not yet supported"});
}

AutoApp.prototype.appendTx = function(req, cb) {
  console.log('auto: append tx');
  var txBytes = req.data.toBuffer();
  var hexString = txBytes.toString();
  this.txs.push(hexString);

  var hexArray = txBytes.toString().split(";");
  var fromKey = hexArray[0], 
      toKey = hexArray[1], 
      amount = parseInt(hexArray[2]);

  this.balance[fromKey] -= amount;
  this.balance[toKey] += amount;
  console.log("auto: " + fromKey + " new balance: " + this.balance[fromKey]);
  console.log("auto: " + toKey + " new balance: " + this.balance[toKey]);

  return cb({code:tmsp.CodeType_OK});
}

AutoApp.prototype.checkTx = function(req, cb) {
  console.log('auto: check tx');
  var txBytes = req.data.toBuffer();
  var hexArray = txBytes.toString().split(";");

  var fromKey = hexArray[0], 
      toKey = hexArray[1], 
      amount = parseInt(hexArray[2]),
      fromBal = this.balance[fromKey],
      toBal = this.balance[toKey];

  if (fromBal === undefined || toBal === undefined) {
    console.log("auto: unknown account");
    return cb({code:tmsp.CodeType.UnknownAccount, log:"Unknown Account"}); 
  }

  if (fromBal < amount) {
    console.log("auto: insufficient funds");
    return cb({code:tmsp.CodeType.InsufficientFunds, log:"Insufficient Funds"}); 
  }

  return cb({code:tmsp.CodeType_OK});
}

AutoApp.prototype.commit = function(req, cb) {
  if (this.txs.length === 0){
    console.log("auto: commit zero tx count; hash is empth");
    return cb({log:"Zero tx count; hash is empth"});
  }

  this.tree = merkle('sha1').sync(this.txs);

  var buf = new Buffer(20);
  // TODO: check req endian type
  buf.writeIntBE(this.tree.root(), 0, 20);
  this.hashCount += 1;

  console.log('auto: commit hash ' + this.tree.root());
  return cb({data:buf});
}

AutoApp.prototype.query = function(req, cb) {
  console.log("auto: query not yet supported");
  return cb({code:tmsp.CodeType_OK, log:"Query not yet supported"});
}

console.log("auto: running");

var program = require('commander');
program
  .version(version)
  .option('-a, --addr [tcp://host:port|unix://path]', 'Listen address (default tcp://127.0.0.1:46658)')
  .option('-e, --eyes [tcp://host:port|unix://path]', 'MerkleEyes address (default tcp://127.0.0.1:46659)')
  .parse(process.argv);
var addr = tmsp.ParseAddr(program.addr || "tcp://127.0.0.1:46658");

var app = new AutoApp();
var appServer = new tmsp.Server(app);
appServer.server.listen(addr);
