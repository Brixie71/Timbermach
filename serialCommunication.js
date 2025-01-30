const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");

function setupSerial(portName, baudRate = 9600) {
  const port = new SerialPort(portName, { baudRate });
  const parser = port.pipe(new Readline({ delimiter: "\n" }));

  parser.on("data", (data) => {
    console.log(`Serial Data: ${data}`);
  });

  return { port, parser };
}

module.exports = { setupSerial };
