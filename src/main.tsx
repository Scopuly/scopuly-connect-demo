import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createController } from "./controller";
import { createWallet } from "./wallet";
import "./style.css";

// Stellar's browser XDR utilities expect Buffer. No private keys are loaded here.
globalThis.Buffer = Buffer;
const controller = createController(createWallet);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App controller={controller} />
  </StrictMode>,
);
