import { createHash } from "node:crypto";
import { versions } from "node:process";
import { versions as versions2 } from "node:process";
import { ipcRenderer, webUtils, contextBridge } from "electron";
function sha256sum(data) {
  return createHash("sha256").update(data).digest("hex");
}
function send(channel, message) {
  return ipcRenderer.invoke(channel, message);
}
function getPathForFile(file) {
  return webUtils.getPathForFile(file);
}
const exports = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getPathForFile,
  send,
  sha256sum,
  versions
}, Symbol.toStringTag, { value: "Module" }));
const isExport = (key) => Object.hasOwn(exports, key);
for (const exportsKey in exports) {
  if (isExport(exportsKey)) {
    contextBridge.exposeInMainWorld(btoa(exportsKey), exports[exportsKey]);
  }
}
export {
  getPathForFile,
  send,
  sha256sum,
  versions2 as versions
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3NlZC5tanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9ub2RlQ3J5cHRvLnRzIiwiLi4vc3JjL2luZGV4LnRzIiwiLi4vc3JjL2V4cG9zZWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHt0eXBlIEJpbmFyeUxpa2UsIGNyZWF0ZUhhc2h9IGZyb20gJ25vZGU6Y3J5cHRvJztcblxuZXhwb3J0IGZ1bmN0aW9uIHNoYTI1NnN1bShkYXRhOiBCaW5hcnlMaWtlKSB7XG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoZGF0YSkuZGlnZXN0KCdoZXgnKTtcbn1cbiIsImltcG9ydCB7c2hhMjU2c3VtfSBmcm9tICcuL25vZGVDcnlwdG8uanMnO1xuaW1wb3J0IHt2ZXJzaW9uc30gZnJvbSAnLi92ZXJzaW9ucy5qcyc7XG5pbXBvcnQge2lwY1JlbmRlcmVyLCB3ZWJVdGlsc30gZnJvbSAnZWxlY3Ryb24nO1xuXG5mdW5jdGlvbiBzZW5kKGNoYW5uZWw6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XG4gIHJldHVybiBpcGNSZW5kZXJlci5pbnZva2UoY2hhbm5lbCwgbWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIGdldFBhdGhGb3JGaWxlKGZpbGU6IEZpbGUpIHtcbiAgcmV0dXJuIHdlYlV0aWxzLmdldFBhdGhGb3JGaWxlKGZpbGUpO1xufVxuXG5leHBvcnQge3NoYTI1NnN1bSwgdmVyc2lvbnMsIHNlbmQsIGdldFBhdGhGb3JGaWxlfTtcbiIsImltcG9ydCAqIGFzIGV4cG9ydHMgZnJvbSAnLi9pbmRleC5qcyc7XG5pbXBvcnQge2NvbnRleHRCcmlkZ2V9IGZyb20gJ2VsZWN0cm9uJztcblxuY29uc3QgaXNFeHBvcnQgPSAoa2V5OiBzdHJpbmcpOiBrZXkgaXMga2V5b2YgdHlwZW9mIGV4cG9ydHMgPT4gT2JqZWN0Lmhhc093bihleHBvcnRzLCBrZXkpO1xuXG5mb3IgKGNvbnN0IGV4cG9ydHNLZXkgaW4gZXhwb3J0cykge1xuICBpZiAoaXNFeHBvcnQoZXhwb3J0c0tleSkpIHtcbiAgICBjb250ZXh0QnJpZGdlLmV4cG9zZUluTWFpbldvcmxkKGJ0b2EoZXhwb3J0c0tleSksIGV4cG9ydHNbZXhwb3J0c0tleV0pO1xuICB9XG59XG5cbi8vIFJlLWV4cG9ydCBmb3IgdGVzdHNcbmV4cG9ydCAqIGZyb20gJy4vaW5kZXguanMnO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFFTyxTQUFTLFVBQVUsTUFBa0I7QUFDMUMsU0FBTyxXQUFXLFFBQVEsRUFBRSxPQUFPLElBQUksRUFBRSxPQUFPLEtBQUs7QUFDdkQ7QUNBQSxTQUFTLEtBQUssU0FBaUIsU0FBaUI7QUFDdkMsU0FBQSxZQUFZLE9BQU8sU0FBUyxPQUFPO0FBQzVDO0FBRUEsU0FBUyxlQUFlLE1BQVk7QUFDM0IsU0FBQSxTQUFTLGVBQWUsSUFBSTtBQUNyQzs7Ozs7Ozs7QUNQQSxNQUFNLFdBQVcsQ0FBQyxRQUE2QyxPQUFPLE9BQU8sU0FBUyxHQUFHO0FBRXpGLFdBQVcsY0FBYyxTQUFTO0FBQzVCLE1BQUEsU0FBUyxVQUFVLEdBQUc7QUFDeEIsa0JBQWMsa0JBQWtCLEtBQUssVUFBVSxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQUEsRUFBQTtBQUV6RTsifQ==
