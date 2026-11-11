const browserWindow = window as any;
browserWindow.global = window;
browserWindow.process ??= {};
browserWindow.process.env ??= {};
if (!('DEBUG' in browserWindow.process.env)) {
  browserWindow.process.env.DEBUG = undefined;
}
