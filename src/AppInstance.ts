import express from "express";
import { readFile, readFileSync } from "fs"
import path from "path/posix";
import { SqlHelper } from "./helpers/sqlHelper";
import web3 from "web3";
import BN from "bn.js";

export class AppInstance {

    private static instance : AppInstance = null;

    private app : express.Application = null;

    private config : any = null;

    private web3Obj : web3 = null;

    private sql : SqlHelper = null;

    public static Instance() : AppInstance{
        return this.instance;
    }

    public async Initialize(configPath : string, onInitDone : () => void){

        if(AppInstance.instance != null){
            console.error("Error! Already Initialized");
            return;
        }

        readFile(configPath, (err, data) => {
            if(err != null){
                console.error(err);
                return;
            }

            let configString : string = data.toString();
            this.config = JSON.parse(configString);
            
            if(this.config == null){
                return;
            }

            this.app = express();

            this.sql = new SqlHelper({
                host: this.config.database.host,
                databaseName: this.config.database.databaseName,
                port: this.config.database.port,
                user: this.config.database.user,
                pw: this.config.database.pw
            });
            
            this.web3Obj = new web3(this.config.ethProvider);

            this.AddListener();

            this.SetContractEvent();
           
            AppInstance.instance = this;
            
            onInitDone();
        });
    }

    private SetContractEvent(){
        readFile("src/Contract.json", (err, data) => {

            let abiString : string = data.toString();
            let abi = JSON.parse(abiString);
            
            let tokenContract = new this.web3Obj.eth.Contract(abi, this.config.tokenAddress);

            tokenContract.events.Transfer(this.OnTransfer.bind(this));
        });
    }

    private AddListener(){
        if(this.app == null){
             console.error("App instance is not initialized");
             return;
        }

        //this.app.get("/", (req, res) => { res.send(""); });
        
        //web client static hosting
        //this.app.use("/", express.static( path.join(__dirname, "static")));
    }

    private async OnTransfer(error : any, event : any){
        if(error != null ){
            console.error(error);
            return;
        }

        console.log("Transfer event called");
        console.log(event + "\n");

        let transactionHash : string = event.transactionHash;
        let blockHash : string = event.blockHash;
        let contractAddress : string = event.address;
        let eventType : string = event.event;

        // console.log(typeof(event.returnValues) + "\n");
        // console.log(event.returnValues["value"]);
        let from : string = event.returnValues["from"];
        let to : string = event.returnValues["to"];
        let valueString : string = event.returnValues["value"];
        let balance : BN = new BN(valueString);

        let decimals = 18;
        let decimalBN = new BN(decimals);
        let divisor = new BN(10).pow(decimalBN);

        let value = balance.div(divisor);
        let valueDecimal = balance.mod(divisor);

        let getReceiptError : boolean = false;
        let receipt : any = null;

        await this.web3Obj.eth.getTransactionReceipt(transactionHash).then((res) => {
            receipt = res;
        }).catch((reason) => {
            console.error(reason);
            getReceiptError = true;
        });

        if(getReceiptError != false || receipt == null){
            console.error("Get Receipt from provider fail hash : " + transactionHash);
            return;
        }

        console.log("receipt : " + transactionHash);
        console.log(receipt);

        let gasUsed : number = receipt.gasUsed;
        let gasPrice : number = receipt.effectiveGasPrice;

        let status : number = receipt.status == true ? 1 : 0;
        let receiptType : string = receipt.type;

        this.sql.query("insert into transferhistory (transactionHash, blockHash, contractAddress, fromUser, toUser, value, valueDecimal, status, gasUsed, gasPrice, type, eventType) value(?,?,?,?,?,?,?,?,?,?,?,?)", [transactionHash, blockHash, 
        contractAddress, from, to, value.toNumber(), valueDecimal.toNumber(), status, gasUsed, gasPrice,receiptType, eventType], (err, result) => {
            if(err != null){
                console.error(err);
                return;
            }
            
            //console.log(result);
        });
    }

    public Start(){
        if(this.app == null){
            console.error("App instance is not initialized");
            return;
        }
        this.app.listen(this.config.serverPort);
    }
}
