var tress = require('tress'); // Asynchronous job queue with concurrency
var needle = require('needle'); // HTTP client
var log = require('cllc')(); // Simple logger and counter for console
var sqlite3 = require("sqlite3").verbose(); // SQLite3 bindings

const LOG_PERIOD = 100;
const CONCURENCY_DEFAULT = 1;
const CONCURENCY_ERROR = -60000; // if error - wait a minute
const X_START = -90;
const X_END = 40;
const Y_START = -95;
const Y_END = 50;
const DIRECTIONS = ['right', 'left', 'top', 'bottom'];

var results = [];
var jobs_done = 0;

var db = new sqlite3.Database("data.sqlite"); // Open a database handle
db.serialize(function() {
    db.run('DROP TABLE IF EXISTS data');
    db.run('CREATE TABLE data(json_object TEXT)');
});

// Function for processing response data domehow
function process_response(body) {
    //results.push(body);

    db.serialize(function() {
        var statement = db.prepare("INSERT INTO data VALUES (?)");
        statement.run(JSON.stringify(body, null, 0));
        statement.finalize();
    });
}

// Create and configure job queue
var q = tress(function(job, done_callback) { // worker
    url = 'http://dofus-map.com/huntTool/getData.php?x='+job.x+'&y='+job.y+'&direction='+job.di+'&world=0&language=en'
    //console.log(url);
    needle.get(url, function(err, response){
        if (err || response.statusCode !== 200) {
            q.concurrency === CONCURENCY_DEFAULT && log.e((err || response.statusCode) + ' - ' + url);
            return done_callback(true); // return job into queue if request failed
        }
        if (!response.body) {
            q.concurrency === CONCURENCY_DEFAULT && log.e(jobs_done + 'job response is empty -' + url) ;
            return done_callback(true); // return job into queue if response body is empty
        }
        process_response(response.body);
        if (jobs_done % LOG_PERIOD == 0) {
            console.log(jobs_done + ' jobs done');
        }
        jobs_done++;
        //log.step();
        done_callback(); // must call that callback when job finished
    });
}, CONCURENCY_DEFAULT);

q.drain = function() {
    //require('fs').writeFileSync('./data.json', JSON.stringify(results, null, 0));

/*
    var db = new sqlite3.Database("data.sqlite"); // Open a database handle
    db.serialize(function() {

        db.run('DROP TABLE IF EXISTS data');
        db.run('CREATE TABLE data(json_object TEXT)');
        var statement = db.prepare("INSERT INTO data VALUES (?)");
        for (var i = 0; i < results.length; i++) {
            statement.run(JSON.stringify(results[i], null, 0));
        }
        statement.finalize();
        db.close();
    });
*/
    db.close();
    //log.finish();
    //log('Finished');
    console.log('Finished');
}

q.error = function(err) { // not used
    log.e('Job ' + this + ' failed with error ' + err);
};

q.success = function(){
    q.concurrency = CONCURENCY_DEFAULT;
}

q.retry = function(){
    q.concurrency = CONCURENCY_ERROR;
}

//process.exit(0);

var valic_locs = [];

function main() {
    // Here we go
    //log('Start');
    //var jobs_n = (X_END - X_START + 1) * (Y_END - Y_START + 1) * DIRECTIONS.length;
    var jobs_n = valic_locs.length * DIRECTIONS.length;
    console.log('Start ' + jobs_n + ' jobs');
    //log.start('job %s of ' + jobs_n);
    // Push jobs to queue and... wait until all well be done
    // for (var x = X_START; x <= X_END; x++) {
    //     for (var y = Y_START; y <= Y_END; y++) {
    //         for (var di = 0; di < DIRECTIONS.length; di++) {
    //             q.push({x:x, y:y, di:DIRECTIONS[di]});
    //         }
    //     }
    // }
    //for (var area_n = 0; area_n < valic_locs.length; area_n++) {
    for (var loc of valic_locs) {
        //console.log(loc.X + " " + loc.Y);
        for (var di = 0; di < DIRECTIONS.length; di++) {
            q.push({x:loc.X, y:loc.Y, di:DIRECTIONS[di]});
        }
    }
}

needle.get("https://dofusgo.com/json/subAreasWeb.json?v=2.43", function(err, response){
    if (err) throw err;
    if (response.statusCode == 200) {
        console.log(response.body.length);
        valic_locs = response.body;
        main();
    }
});
