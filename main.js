const express = require('express');
const axios = require('axios');
const json2csv = require('json2csv');
const fs = require('fs');
const os = require('os');

const app = express();
const allMarketsUrl = 'https://bittrex.com/api/v1.1/public/getmarkets';
const candleUrl = 'https://bittrex.com/api/v2.0/pub/market/getticks?marketname=MARKETNAME&tickInterval=TICKINTERVAL';

app.use('/',express.static('client'));

app.use('/reports',express.static('reports'));

app.get('/api/markets',(request,response)=>{
    axios(allMarketsUrl).then(
        apiResponse => {
            if(!apiResponse.data.success){
                logError(apiResponse.data.message);
                response.status(500).send(apiResponse.data.message);
            }else{
                const markets = apiResponse.data.result.filter(market => market.IsActive)
                    .map(market => market.MarketName)
                    .sort();
                const marketGroups = [];
                markets.forEach(market => {
                    const marketGroup = market.split('-')[0];
                    if(marketGroups.indexOf(marketGroup)===-1){
                        marketGroups.push(marketGroup)
                    }
                });
                const result = markets.map(market => {
                    return {
                        marketName:market,
                        marketFilter:market
                    }
                });
                marketGroups.forEach(group => {
                    result.unshift({
                        marketName:group+'-XXX',
                        marketFilter:group+'-'
                    });
                });
                result.unshift({
                    marketName:'XXX-XXX',
                    marketFilter:''
                });
                response.send(result);
            }
        },
        error => {
            logError('MARKETS FETCH FAILED');
            response.status(500).send('MARKETS FETCH FAILED');
        }
    );
});

app.get('/api/reports',(request,response)=>{
    const result = [];
    const statsPromise = [];
    fs.readdir('reports',(error,files)=>{
        if(!files){
            response.send([]);
        }else{
            for (let i = 0; i < files.length; i++) {
                statsPromise.push(getFileStats('reports/'+files[i]));
            }
            Promise.all(statsPromise).then(
                stats => {
                    for (let i = 0; i < files.length; i++) {
                        result.push({
                            filename:files[i],
                            createdTime:stats[i].birthtimeMs
                        });
                    }
                    result.sort((item1,item2)=>item1.createdTime<item2.createdTime);
                    response.send(result);
                },
                error => response.status(500).send(error)
            );
        }
    });
});

app.get('/api/report',(request,response)=>{
    const {marketfilter,marketname,interval} = request.query;
    const filename = marketname+'_'+interval+'_'+new Date().getTime()+'.csv';
    axios(allMarketsUrl).then(
        apiResponse => {
            if(!apiResponse.data.success){
                logError(response.data.message);
                response.status(500).send(response.data.message);
            }else{
                const promises = [];
                apiResponse.data.result.forEach((market,index)=>{
                    if(market.MarketName.indexOf(marketfilter)>-1){
                        const url = candleUrl.replace('MARKETNAME',market.MarketName).replace('TICKINTERVAL',interval);
                        promises.push(
                            axios(url).then(
                                apiResponse => {
                                    if(!apiResponse.data.success){
                                        logError('FETCH FAILED FOR : '+market.MarketName);
                                    }else{
                                        const csvData = json2csv({
                                            data:apiResponse.data.result,
                                            fields:[
                                                {value:row=>market.MarketName},
                                                {value:row=>row['T'].replace('T',',')},
                                                {value:row=>row['O'].toFixed(8),stringify:false},
                                                {value:row=>row['H'].toFixed(8),stringify:false},
                                                {value:row=>row['L'].toFixed(8),stringify:false},
                                                {value:row=>row['C'].toFixed(8),stringify:false},
                                                {value:row=>row['V']}
                                            ],
                                            hasCSVColumnTitle:false,
                                            quotes:''
                                        });
                                        return appendToFile('reports/'+filename,os.EOL+csvData,'utf8').then(
                                            () => {},
                                            error => logError('WRITE FAILED FOR : '+market.MarketName)
                                        );
                                    }
                                },
                                error => logError('FETCH FAILED FOR : '+market.MarketName)
                            )
                        );
                    }
                });
                Promise.all(promises).then(
                    () => response.send('REPORT GENERATED'),
                    error => logError(error)
                );
            }
        },
        error => {
            logError('MARKETS FETCH FAILED');
            response.status(500).send('MARKETS FETCH FAILED');
        }
    );
});

app.listen(8080,() => console.log('LISTENING AT PORT 8080'));

function appendToFile(filename,data,encoding){
    return new Promise((resolve,reject)=>{
        fs.appendFile(filename,data,encoding,(error)=>{
            if(error){
                reject(error);
            }else{
                resolve();
            }
        });
    });
}

function logError(message){
    appendToFile('reports/errors.log',os.EOL+(new Date().toLocaleString()+' : '+message),'utf8');
}

function getFileStats(file){
    return new Promise((resolve,reject)=>{
        fs.stat(file,(error,stats)=>{
            if(error){
                reject(error);
            }else{
                resolve(stats);
            }
        });
    });
}
