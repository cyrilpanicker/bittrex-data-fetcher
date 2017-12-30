NProgress.configure({ showSpinner: false });

axios.interceptors.request.use(
    function(config){
        NProgress.start();
        return config;
    },
    function(error){
        NProgress.done();
        console.log(error);
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    function(response){
        NProgress.done();
        return response;
    },
    function(error){
        NProgress.done();
        console.log(error);
        return Promise.reject(error);
    }
);

var app = new Vue({
    el:'#app',
    data:{
        loaded:false,
        markets:[],
        reports:[],
        selectedMarket:null,
        selectedInterval:null
    },
    methods:{
        generateReport:function(){
            const selectedMarketName = app.markets.filter(market => market.marketFilter===app.selectedMarket)[0].marketName
            const url = '/api/report?marketname='+selectedMarketName+'&marketfilter='+app.selectedMarket+'&interval='+app.selectedInterval;
            axios(url).then(
                response => {
                    axios('/api/reports').then(
                        function(response){
                            app.reports = response.data;
                            app.selectedMarket=null;
                            app.selectedInterval=null;
                        },
                        function(error){
                            console.log(error.response.data);
                        }
                    );
                },
                error => console.log(error)
            );
        }
    },
    created:function(){
        var promise1 = axios('/api/markets').then(
            function(response){
                app.markets = response.data;
            },
            function(error){
                console.log(error.response.data);
            }
        );
        var promise2 = axios('/api/reports').then(
            function(response){
                app.reports = response.data;
            },
            function(error){
                console.log(error.response.data);
            }
        );
        Promise.all([promise1,promise2]).then(
            ()=>app.loaded=true,
            ()=>app.loaded=true
        );
    }
});