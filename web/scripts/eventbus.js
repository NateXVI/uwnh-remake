function EVENTBUS() {
    this.registered = {};
}
EVENTBUS.prototype.addEventListener = function (name, callback) {
    if (!this.registered[name]) this.registered[name] = [];
    this.registered[name].push(callback);
}
EVENTBUS.prototype.triggerEvent = function (name, ...args) {
    // console.log('eventbus args:', args);
    this.registered[name]?.forEach(fnc => fnc.apply(this, args));
}

export { EVENTBUS };
