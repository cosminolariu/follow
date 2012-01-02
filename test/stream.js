var tap = require('tap')
  , test = tap.test
  , util = require('util')
  , request = require('request')

var couch = require('./couch')
  , follow = require('../api')


couch.setup(test)

test('Readable Stream API', function(t) {
  var feed = new follow.Changes

  t.is(feed.readable, true, 'Changes is a readable stream')

  t.type(feed.setEncoding, 'function', 'Changes has .setEncoding() method')
  t.type(feed.pause, 'function', 'Changes has .pause() method')
  t.type(feed.resume, 'function', 'Changes has .resume() method')
  t.type(feed.destroy, 'function', 'Changes has .destroy() method')
  t.type(feed.destroySoon, 'function', 'Changes has .destroySoon() method')
  t.type(feed.pipe, 'function', 'Changes has .pipe() method')
  return t.end()

  t.end()
})

test('Writatable Stream API', function(t) {
  var feed = new follow.Changes

  t.is(feed.writable, true, 'Changes is a writable stream')

  t.type(feed.write, 'function', 'Changes has .write() method')
  t.type(feed.end, 'function', 'Changes has .end() method')
  t.type(feed.destroy, 'function', 'Changes has .destroy() method')
  t.type(feed.destroySoon, 'function', 'Changes has .destroySoon() method')

  t.end()
})

test('Error conditions', function(t) {
  var feed = new follow.Changes

  t.throws(write, 'Throw if the feed type is not defined')

  feed.feed = 'neither longpoll nor continuous'
  t.throws(write, 'Throw if the feed type is not longpoll nor continuous')

  feed = new follow.Changes({'feed':'longpoll'})
  t.throws(write('stuff'), 'Throw if the "results" line is not sent first')

  feed = new follow.Changes({'feed':'longpoll'})
  t.doesNotThrow(write('')    , 'Empty string is fine waiting for "results"')
  t.doesNotThrow(write('{')   , 'This could be the "results" line')
  t.doesNotThrow(write('"resu', 'Another part of the "results" line'))
  t.doesNotThrow(write('')    , 'Another empty string is still fine')
  t.doesNotThrow(write('lts":', 'Final part of "results" line still good'))
  t.throws(write(']'), 'First line was not {"results":[')

  t.end()

  function write(data) {
    if(data === undefined)
      return feed.write('blah')
    return function() { feed.write(data) }
  }
})

test('Longpoll feed', function(t) {
  var feed = new follow.Changes({'feed':'longpoll'})

  var data = []
  feed.on('data', function(d) { data.push(d) })

  function write(data) { return function() { feed.write(data) } }
  function end(data) { return function() { feed.end(data) } }

  t.doesNotThrow(write('{"results":[')           , 'Longpoll header')
  t.doesNotThrow(write('{}')                     , 'Empty object')
  t.doesNotThrow(write(',{"foo":"bar"},')        , 'Comma prefix and suffix')
  t.doesNotThrow(write('{"two":"bar"},')         , 'Comma suffix')
  t.doesNotThrow(write('{"three":3},{"four":4}'), 'Two objects on one line')
  t.doesNotThrow(end('],\n"last_seq":3}\n')      , 'Longpoll footer')

  t.equal(data.length, 5, 'Five data events fired')
  t.equal(data[0], '{}', 'First object emitted')
  t.equal(data[1], '{"foo":"bar"}', 'Second object emitted')
  t.equal(data[2], '{"two":"bar"}', 'Third object emitted')
  t.equal(data[3], '{"three":3}', 'Fourth object emitted')
  t.equal(data[4], '{"four":4}', 'Fifth object emitted')

  t.end()
})

test('Longpoll pause', function(t) {
  var feed = new follow.Changes({'feed':'longpoll'})
    , all = {'results':[{'change':1}, {'second':'change'},{'change':'#3'}], 'last_seq':3}
    , start = new Date

  var events = []

  feed.on('data', function(change) {
    change = JSON.parse(change)
    change.elapsed = new Date - start
    events.push(change)
  })

  feed.once('data', function(data) {
    t.equal(data, '{"change":1}', 'First data event was the first change')
    feed.pause()
    setTimeout(function() { feed.resume() }, 100)
  })

  feed.on('end', function() {
    t.equal(feed.readable, false, 'Feed is no longer readable')
    events.push('END')
  })

  setTimeout(check_events, 150)
  feed.end(JSON.stringify(all))

  function check_events() {
    t.equal(events.length, 3+1, 'Three data events, plus the end event')

    t.ok(events[0].elapsed < 10, 'Immediate emit first data event')
    t.ok(events[1].elapsed >= 100 && events[1].elapsed < 125, 'About 100ms delay until the second event')
    t.ok(events[2].elapsed - events[1].elapsed < 10, 'Immediate emit of subsequent event after resume')
    t.equal(events[3], 'END', 'End event was fired')

    t.end()
  }
})