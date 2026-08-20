import "bootstrap-icons/font/bootstrap-icons.css";
import { render } from "preact";
import { UniverseApp } from "./UniverseApp";
import "./universe.css";

render(<UniverseApp />, document.getElementById("app")!);
