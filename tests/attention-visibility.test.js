import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createVisibilityAttention } from '../src/content/attention-visibility.js';

class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
  }
  observe(element) {
    this.targets.add(element);
  }
  unobserve(element) {
    this.targets.delete(element);
  }
  emit(element, visible) {
    this.callback([
      {
        target: element,
        isIntersecting: visible,
        intersectionRatio: visible ? 0.9 : 0,
        intersectionRect: { height: visible ? 300 : 0 },
        rootBounds: { height: 800 },
      },
    ]);
  }
}

function setup({ active = true } = {}) {
  mock.timers.enable({ apis: ['setTimeout'] });
  let observer;
  const doc = {
    visibilityState: 'visible',
    listeners: [],
    addEventListener(_type, fn) {
      this.listeners.push(fn);
    },
    setState(state) {
      this.visibilityState = state;
      this.listeners.forEach((fn) => fn());
    },
  };
  const read = [];
  const state = { active };
  const tracker = createVisibilityAttention({
    isActive: () => state.active,
    getRequiredViewMs: () => 2000,
    onTweetRead: (el) => read.push(el),
    ObserverCtor: class extends FakeObserver {
      constructor(cb) {
        super(cb);
        observer = this;
      }
    },
    doc,
    getViewportHeight: () => 800,
  });
  const element = { isConnected: true, style: {} };
  return { tracker, observer, doc, read, element, state };
}

test('counts a tweet after it stays visible for the required time', () => {
  const { tracker, observer, read, element } = setup();
  tracker.observe(element);
  observer.emit(element, true);
  mock.timers.tick(1999);
  assert.equal(read.length, 0);
  mock.timers.tick(1);
  assert.deepEqual(read, [element]);
  assert.equal(tracker.isObserving(element), true);
  mock.timers.reset();
});

test('scrolling away before the time resets the dwell', () => {
  const { tracker, observer, read, element } = setup();
  tracker.observe(element);
  observer.emit(element, true);
  mock.timers.tick(1500);
  observer.emit(element, false);
  mock.timers.tick(5000);
  assert.equal(read.length, 0);
  observer.emit(element, true);
  mock.timers.tick(2000);
  assert.equal(read.length, 1);
  mock.timers.reset();
});

test('a hidden page pauses the dwell and resumes from zero when shown', () => {
  const { tracker, observer, doc, read, element } = setup();
  tracker.observe(element);
  observer.emit(element, true);
  mock.timers.tick(1500);
  doc.setState('hidden');
  mock.timers.tick(10_000);
  assert.equal(read.length, 0);
  doc.setState('visible');
  mock.timers.tick(1999);
  assert.equal(read.length, 0);
  mock.timers.tick(1);
  assert.equal(read.length, 1);
  mock.timers.reset();
});

test('does not count while tracking is inactive, and cancelAll drops pending timers', () => {
  const { tracker, observer, read, element, state } = setup({ active: false });
  tracker.observe(element);
  observer.emit(element, true);
  mock.timers.tick(5000);
  assert.equal(read.length, 0);

  state.active = true;
  observer.emit(element, true);
  mock.timers.tick(1000);
  tracker.cancelAll();
  mock.timers.tick(5000);
  assert.equal(read.length, 0);
  assert.equal(tracker.isObserving(element), false);
  mock.timers.reset();
});
