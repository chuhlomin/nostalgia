import {sha256sum} from './nodeCrypto.js';
import {versions} from './versions.js';
import {ipcRenderer, webUtils} from 'electron';

function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}

function getPathForFile(file: File) {
  return webUtils.getPathForFile(file);
}

export {sha256sum, versions, send, getPathForFile};
