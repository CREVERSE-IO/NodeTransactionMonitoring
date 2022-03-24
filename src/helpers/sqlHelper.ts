import mysql from "mysql";

export interface sqlHelperConfig{
    host : string,
    port : number,
    databaseName : string,
    user : string,
    pw : string
}

export class SqlHelper{

    private host : string = "";                                                                                                                                                                                                                                                                                                             
    private port : number = -1;
    private databaseName : string = "";
    private user : string = "";
    private pw : string = "";

    private databasePool : mysql.Pool = null;

    public constructor(sqlConfig : sqlHelperConfig){
        // sqlConfig Contain : 
        // host : string
        // port : number
        // database : string
        // user : string
        // pw : string

        this.host = sqlConfig.host;
        this.port = sqlConfig.port;
        this.databaseName = sqlConfig.databaseName;
        this.user = sqlConfig.user;
        this.pw = sqlConfig.pw;

        this.createPool();

        if(this.databasePool == null){
            console.error("sqlHelper Error Create DatabasePool Failed");
            return;
        }

        console.log("sqlHelper Initialized");
    }

    private createPool() {
        try {
            this.databasePool = mysql.createPool({
                host : this.host,
                port : this.port,
                database : this.databaseName,
                user : this.user,
                password : this.pw,

                connectionLimit : 100,
                waitForConnections : true,
                dateStrings : true
            });
        }
        catch(e){
            console.error("Create DB Pool Error e : " + e);
            console.error("info host : " + this.host  + " databaseName : " + this.databaseName + " user : " + this.user +" pw : " + this.pw);
            return;
        }

        this.databasePool.on("enqueue", () => {
            console.warn(" database waiting for available connection slot");
        });
    }

    public query(sql : string, args : any, callback : (err : mysql.MysqlError, result : any)=>void){

        console.log("request Query " + sql);

        this.databasePool.getConnection((error : mysql.MysqlError, connection : mysql.PoolConnection) => {
            if(error != null){
                callback(error, null);
            }

            connection.query(sql, args, (error, result)=>{
                connection.release();
                callback(error, result);
            })
        })
    }

    public async queryAsync(sql : string, args : any, callback : (err : mysql.MysqlError, result : any) => void) : Promise<boolean>{

        console.log("request Query Async" + sql);

        let promise = new Promise<boolean>((resolve, reject) => {
            this.databasePool.getConnection((error : mysql.MysqlError, connection : mysql.PoolConnection) => {
                if(error != null){
                    callback(error, null);
                    resolve(false);
                }
    
                connection.query(sql, args, (error, result)=>{
                    connection.release();
                    callback(error, result);
                    resolve(true);
                })
            });
        });

        return promise;
    }
    
    public shutDown(){
        console.log("SQL Proxy shutdown");
        this.databasePool.end((error)=> {
            console.error("Database Pool End Error : " + error);
        })
    }
}