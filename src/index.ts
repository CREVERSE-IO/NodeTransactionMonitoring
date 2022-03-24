import { AppInstance } from "./AppInstance";

let app = new AppInstance();

app.Initialize("src/serverConfig.json", () => {
    console.log("Init done start server");
    app.Start();
});