const express = require("express");
const bodyParser = require("body-parser");
const {MongoClient} = require("mongodb");
const PgMem = require("pg-mem");

const db = PgMem.newDb();

    const render = require("./render.js");
// Measurements database setup and access

let database = null;
const collectionName = "measurements";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=-35.025&longitude=-58.423&current=temperature_2m,surface_pressure&timezone=America%2FArgentina%2FBuenos_Aires";
let weatherRequestInProgress = false;

async function startDatabase() {
    const uri = "mongodb://localhost:27017/?maxPoolSize=20&w=majority";	
    const connection = await MongoClient.connect(uri);
    database = connection.db();
}

async function getDatabase() {
    if (!database) await startDatabase();
    return database;
}

async function insertMeasurement(message) {
    const {insertedId} = await database.collection(collectionName).insertOne(message);
    return insertedId;
}

async function getMeasurements() {
    return await database.collection(collectionName).find({}).toArray();	
}

async function insertExternalWeatherMeasurement() {
    if (weatherRequestInProgress) return;

    weatherRequestInProgress = true;
    try {
        const response = await fetch(WEATHER_URL);
        if (!response.ok) {
            throw new Error("Open-Meteo request failed with status " + response.status);
        }

        const weather = await response.json();
        const current = weather.current;
        if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current?.surface_pressure)) {
            throw new Error("Open-Meteo response is missing temperature or pressure");
        }

        const timestamp = new Date();
        const insertedId = await insertMeasurement({
            id: "00",
            t: current.temperature_2m,
            p: current.surface_pressure*100,
            timestamp: timestamp
        });

        console.log("device id: 00 temperature: " + current.temperature_2m + " C pressure: " + current.surface_pressure + " hPa timestamp: " + timestamp.toISOString() + " inserted: " + insertedId);
    } catch (error) {
        console.error("Error fetching external weather measurement:", error);
    } finally {
        weatherRequestInProgress = false;
    }
}

// API Server

const app = express();

app.use(bodyParser.urlencoded({extended:false}));
//agregodo de parser JSON GA
app.use(express.json());

app.use(express.static('spa/static'));

const PORT = 8080;

app.post('/measurement', async function (req, res) {
    try {
        // Keep server reception time and optional device time separately.
        const timestamp = new Date();
        const deviceTimestamp = req.body.timestamp;
        if (deviceTimestamp !== undefined &&
            (typeof deviceTimestamp !== 'string' || deviceTimestamp.trim() === '')) {
            return res.status(400).send("timestamp must be a valid date string, e.g. 2026-10-08T15:30:00Z");
        }
        const deviceDate = deviceTimestamp === undefined
            ? null
            : new Date(deviceTimestamp);
        if (deviceDate !== null && Number.isNaN(deviceDate.getTime())) {
            return res.status(400).send("timestamp must be a valid date string, e.g. 2026-10-08T15:30:00Z");
        }
        //console.log("device id: " + req.body.id + " temperature: " + req.body.t + " humidity1: " + req.body.h + " timestamp: " + timestamp.toISOString());
        console.log("device id: " + req.body.id + " temperature: " + req.body.t + " pressure: " + req.body.p + " timestamp: " + timestamp.toISOString() + " deviceTimestamp: " + (deviceDate === null ? "not provided" : deviceDate.toISOString()));

        const insertedId = await insertMeasurement({
            id: req.body.id,
            t: req.body.t,
            //h: req.body.h,
            p: req.body.p,
            timestamp: timestamp,
            deviceTimestamp: deviceDate
        });
        res.send("received measurement into " + insertedId);
    } catch (error) {
        console.error("Error saving measurement:", error);
        res.status(500).send("could not save measurement");
    }
});





app.post('/device', function (req, res) {
	console.log("device id    : " + req.body.id + " name        : " + req.body.n + " key         : " + req.body.k );

    db.public.none("INSERT INTO devices VALUES ('"+req.body.id+ "', '"+req.body.n+"', '"+req.body.k+"')");
	res.send("received new device");
});


app.get('/web/device', function (req, res) {
	var devices = db.public.many("SELECT * FROM devices").map( function(device) {
		console.log(device);
		return '<tr><td><a href=/web/device/'+ device.device_id +'>' + device.device_id + "</a>" +
			       "</td><td>"+ device.name+"</td><td>"+ device.key+"</td></tr>";
	   }
	);
	res.send("<html>"+
		     "<head><title>Sensores</title></head>" +
		     "<body>" +
		        "<table border=\"1\">" +
		           "<tr><th>id</th><th>name</th><th>key</th></tr>" +
		           devices +
		        "</table>" +
		     "</body>" +
		"</html>");
});

app.get('/web/device/:id', function (req,res) {
    var template = "<html>"+
                     "<head><title>Sensor {{name}}</title></head>" +
                     "<body>" +
		        "<h1>{{ name }}</h1>"+
		        "id  : {{ id }}<br/>" +
		        "Key : {{ key }}" +
                     "</body>" +
                "</html>";


    var device = db.public.many("SELECT * FROM devices WHERE device_id = '"+req.params.id+"'");
    console.log(device);
    res.send(render(template,{id:device[0].device_id, key: device[0].key, name:device[0].name}));
});	


app.get('/term/device/:id', function (req, res) {
    var red = "\33[31m";
    var green = "\33[32m";
    var blue = "\33[33m";
    var reset = "\33[0m";
    var template = "Device name " + red   + "   {{name}}" + reset + "\n" +
		   "       id   " + green + "       {{ id }} " + reset +"\n" +
	           "       key  " + blue  + "  {{ key }}" + reset +"\n";
    var device = db.public.many("SELECT * FROM devices WHERE device_id = '"+req.params.id+"'");
    console.log(device);
    res.send(render(template,{id:device[0].device_id, key: device[0].key, name:device[0].name}));
});

app.get('/measurement', async (req,res) => {
    res.send(await getMeasurements());
});

app.get('/device', function(req,res) {
    res.send( db.public.many("SELECT * FROM devices") );
});




/// Nuevo endpoint
app.post('/measurements', async function (req, res) {
    try {
        const measurements = req.body;

        if (!Array.isArray(measurements) || measurements.length === 0) {
            return res.status(400).send("expected a non-empty array of measurements");
        }

        const timestamp = new Date();

        const documents = [];
        for (const [index, m] of measurements.entries()) {
            if (m === null || typeof m !== 'object' || Array.isArray(m)) {
                return res.status(400).send("measurement at index " + index + " must be an object");
            }

            const deviceTimestamp = m.timestamp;
            if (deviceTimestamp !== undefined &&
                (typeof deviceTimestamp !== 'string' || deviceTimestamp.trim() === '')) {
                return res.status(400).send("timestamp at index " + index + " must be a valid date string, e.g. 2026-10-08T15:30:00Z");
            }
            const deviceDate = deviceTimestamp === undefined
                ? null
                : new Date(deviceTimestamp);
            if (deviceDate !== null && Number.isNaN(deviceDate.getTime())) {
                return res.status(400).send("timestamp at index " + index + " must be a valid date string, e.g. 2026-10-08T15:30:00Z");
            }

            documents.push({
                id: m.id,
                t: m.t,
                p: m.p,
                timestamp: timestamp,
                deviceTimestamp: deviceDate
            });
        }

        const result = await database
            .collection(collectionName)
            .insertMany(documents);

        console.log("received " + result.insertedCount + " measurements");

        res.send("received " + result.insertedCount + " measurements");

    } catch (error) {
        console.error("Error saving measurements:", error);
        res.status(500).send("could not save measurements");
    }
});

startDatabase().then(async() => {

    const addAdminEndpoint = require("./admin.js");
    addAdminEndpoint(app, render);

    await insertMeasurement({id:'00', t:'18', p:'78'});
    await insertMeasurement({id:'00', t:'19', p:'77'});
    await insertMeasurement({id:'00', t:'17', p:'77'});
    await insertMeasurement({id:'01', t:'17', p:'77'});
    console.log("mongo measurement database Up");
    void insertExternalWeatherMeasurement();
    setInterval(insertExternalWeatherMeasurement, 30_000);

    db.public.none("CREATE TABLE devices (device_id VARCHAR, name VARCHAR, key VARCHAR)");
    db.public.none("INSERT INTO devices VALUES ('00', 'Fake Device 00', '123456')");
    db.public.none("INSERT INTO devices VALUES ('01', 'Fake Device 01', '234567')");
    db.public.none("CREATE TABLE users (user_id VARCHAR, name VARCHAR, key VARCHAR)");
    db.public.none("INSERT INTO users VALUES ('1','Ana','admin123')");
    db.public.none("INSERT INTO users VALUES ('2','Beto','user123')");

    console.log("sql device database up");

    app.listen(PORT, () => {
        console.log(`Listening at ${PORT}`);
    });
});
