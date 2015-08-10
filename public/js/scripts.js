
//// ▶▶ Angular ◀◀ ////
var testapp = angular.module('testApp',['ui.bootstrap','ngCart','angular-md5','ngCookies','angular-jwt']);
testapp.controller('flightController',function($scope,$http,$window,ngCart,md5,$cookieStore,jwtHelper){
    $scope.formData = {h2:"Please Take a Moment to Create an Account"};
    $scope.showCode=false;
    $scope.empty=true;
    $scope.cart=false;
    $scope.retEmpty=true;
    $scope.fliEmpty=true;
    $scope.leave="";
    $scope.ret="";
    $scope.fact="This window will narrate application interaction including N1QL Queries in the console";
    $scope.rowCollectionLeave=[];
    $scope.rowCollectionRet=[];
    $scope.rowCollectionFlight=[];
    $scope.login = function(){
        var curUser=this.formData.username;
        $cookieStore.remove('token');
        $cookieStore.remove('user');
        if(this.formData.h2.indexOf("Create")!=-1){
            $http.post("/api/user/login",{user:curUser,
                password:md5.createHash(this.formData.password)})
                .then(function(response){
                                     if(response.data.success){
                                         $scope.formData.error=null;
                                         $cookieStore.put('token',response.data.success);
                                         $cookieStore.put('user',jwtHelper.decodeToken(response.data.success).user);
                                         $window.location.href="http://" + $window.location.host + "/index.html";
                                     }
                                      if(response.data.failure) {
                                          $scope.formData.error = response.data.failure;
                                      }
                                  });
        }else{
            $http.get("/api/user/login", {
                params:{user:this.formData.username,
                    password:md5.createHash(this.formData.password)}})
                .then(function(response){
                                      if(response.data.success){
                                          $scope.formData.error=null;
                                          $cookieStore.put('token',response.data.success);
                                          $cookieStore.put('user',jwtHelper.decodeToken(response.data.success).user)
                                          $window.location.href="http://" + $window.location.host + "/index.html";
                                      }
                                      if(response.data.failure) {
                                          $scope.formData.error = response.data.failure;
                                      }
                                  });
            }
        }
    $scope.findAirports=function(val){
        $scope.fact="Typeahead bound to REST call: /api/airport/findAll";
        $scope.publishDebug("/api/airport/findAll");
        return $http.get("/api/airport/findAll",{
            params:{search:val,token:$cookieStore.get('token')}
        }).then(function(response){
            return response.data;
        });
    }
    $scope.findFlights = function () {
        $scope.fact="Searching for flights using REST call: /api/flightPath/findAll";
        $scope.empty = true;
        $scope.rowCollectionLeave = [];
        $scope.rowCollectionRet = [];
        $scope.leave=this.leave;
        $scope.publishDebug("/api/flightPath/findAll");
        $http.get("/api/flightPath/findAll", {
            params: {from: this.fromName, to: this.toName, leave: this.leave,token:$cookieStore.get('token')}
        }).then(function (response) {
            if (response.data.length > 0) {
                $scope.empty = false;
            }
            for (var j = 0; j < response.data.length; j++) {
                var d= new Date(Date.parse($scope.leave + " " + response.data[j].utc));
                d.setHours(d.getHours()+response.data[j].flighttime);
                response.data[j].utcland = d.getHours() + ":" + d.getMinutes() + ":00";
                $scope.rowCollectionLeave.push(response.data[j]);
            }
        });
        if (this.ret) {
            $scope.publishDebug("/api/flightPath/findAll");
            $scope.ret=this.ret;
            $http.get("/api/flightPath/findAll", {
                params: {from: this.toName, to: this.fromName, leave: this.ret,token:$cookieStore.get('token')}
            }).then(function (responseRet) {
                if (responseRet.data.length > 0) {
                    $scope.retEmpty = false;
                }
                for (var j = 0; j < responseRet.data.length; j++) {
                    var d= new Date(Date.parse($scope.ret + " " + responseRet.data[j].utc));
                    d.setHours(d.getHours()+responseRet.data[j].flighttime);
                    responseRet.data[j].utcland = d.getHours() + ":" + d.getMinutes() + ":00";
                    $scope.rowCollectionRet.push(responseRet.data[j]);
                }
            });
        }
    }

    $scope.findBookedFlights = function(){
        $http.get("/api/user/flights",{
            params:{token:$cookieStore.get('token')}
        }).then(function(responseFlights){
            if (responseFlights.data.length > 0) {
                $scope.fliEmpty = false;
            }
            for (var j = 0; j < responseFlights.data.length; j++) {
                $scope.rowCollectionFlight.push(responseFlights.data[j]);
            }
        });
    }

    $scope.removeRow=function(row) {
        var index = $scope.rowCollectionLeave.indexOf(row);
        if (index !== -1) {
            $scope.rowCollectionLeave.splice(index, 1);
        }
    }

    $scope.selectRow=function(row){
        $scope.fact="Native Angular Validation, choose OUTBOUND row "
        $scope.rowCollectionLeave=[];
        $scope.rowCollectionLeave.push(row);
        row.date=this.leave;
        ngCart.addItem(row.flight,row.name +"-"+row.flight,row.price,1,row);
        var tempRet=[];
        for (var k=0;k<$scope.rowCollectionRet.length;k++){
            if($scope.rowCollectionRet[k].name == row.name){
                tempRet.push($scope.rowCollectionRet[k]);
            }
        }
        $scope.rowCollectionRet=tempRet;
    }

    $scope.removeRowRet = function removeRowRet(row) {
        var index = $scope.rowCollectionRet.indexOf(row);
        if (index !== -1) {
            $scope.rowCollectionRet.splice(index, 1);
        }
    }

    $scope.selectRowRet=function(row){
        $scope.fact="Native Angular Validation, choose INBOUND row ";
        $scope.rowCollectionRet=[];
        $scope.rowCollectionRet.push(row);
        row.date=this.ret;
        ngCart.addItem(row.flight,row.name +"-"+row.flight,row.price,1,row);
        var tempLeave=[];
        for (var j=0;j<$scope.rowCollectionLeave.length;j++){
            if($scope.rowCollectionLeave[j].name == row.name){
                tempLeave.push($scope.rowCollectionLeave[j]);
            }
        }
        $scope.rowCollectionLeave=tempLeave;
    }

    $scope.publishDebug=function(req){
        if($scope.showCode){
            $("#textAreaShowMe").val("REST REQ≔"+req + "\n" + $("#textAreaShowMe").val());
        }
    }


    //// ▶▶ Jquery inside Angular ◀◀ ////
    $('.input-daterange').datepicker(
        {
            "todayHighlight": true,
            "autoclose":true,
            "startDate":"+0d"
        }
    ).on("changeDate", function(ev) {
        var date = new Date(ev.date);
        $("#textAreaShowMe").val("DATE SELECTED≔" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + "\n" + $("#textAreaShowMe").val());
    }).on("show",function(sh){
                  $scope.fact="Selecting DATE from DatePicker";
              });

    $("#textAreaShowMe").hide();
    $(".insFooter").hide();

    $("input.switch").bootstrapSwitch({
                                          onText: '⇄',
                                          offText: '→',
                                          size: 'mini',
                                          state: true
                                      });
    $("input.switch").on('switchChange.bootstrapSwitch', function (event, state) {
        if(!state){
            $scope.fact="Changing to ONE WAY";
            $("#retDate").hide();
            $("#retSpan").hide();
            $("#retLabel").html("ONE WAY");
            $scope.retEmpty=true;
            $scope.$apply();
        }else{
            $scope.fact="Changing to ROUND TRIP";
            $("#retDate").show();
            $("#retSpan").show();
            $("#retLabel").html("ROUND TRIP");
            $scope.retEmpty=false;
            $scope.$apply();
        }
    });

    $("input.switchShowMe").bootstrapSwitch({
                                          onText: '⚆',
                                          offText: '⚡',
                                          size: 'mini',
                                          state: true
                                            });
    $("input.switchShowMe").on('switchChange.bootstrapSwitch', function (event, state) {
        if (!state) {
            $scope.showCode=true;
            $("#textAreaShowMe").show();
            $(".insFooter").show();
            var client = new Faye.Client("http://"+ $window.location.hostname + ":8000"+"/faye");
            var subscription = client.subscribe('/'+$cookieStore.get('user'), function(message) {
                $("#textAreaShowMe").val(message.text + "\n" + $("#textAreaShowMe").val());
            });
        } else {
            $scope.showCode=false;
            $("#textAreaShowMe").hide();
            $(".insFooter").hide();
        }
    });
});
