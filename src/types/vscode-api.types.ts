export interface VSCodeAPI {
  postMessage: (message: any) => void;
}

declare global {
  interface Window {
    vscode: VSCodeAPI;
  }
}