var travelApp = angular.module("travelapp", ["ui.router", 'ui.bootstrap','ngCart','angular-md5','ngCookies','angular-jwt']);
var fayeClient = null;

/*
 * AngularJS Config Method
 *
 * All configuration happens here.  Usually routes and or language (i18n, l10n) goes here
 */
travelApp.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state("home", {
            url: "/home",
            templateUrl: "templates/home.html",
            controller: "HomeController"
        })
        .state("login", {
            url: "/login",
            templateUrl: "templates/login.html",
            controller: "LoginController"
        })
        .state("cart", {
            url: "/cart",
            templateUrl: "templates/cart.html"
        })
        .state("user", {
            url: "/user",
            templateUrl: "templates/user.html",
            controller: "UserController"
        });
});

/*
 * AngularJS Run Method
 *
 * All global initialization happens in this method.  It is run only once when the application is first
 * loaded
 */
travelApp.run(function($rootScope, $state, $cookies) {
    $rootScope.showCode = false;
    $rootScope.publishMessage = function(message) {
        $rootScope.textAreaShowMe = message + "\n" + ($rootScope.textAreaShowMe ? $rootScope.textAreaShowMe : "");
    };
    fayeClient = new Faye.Client("http://" + window.location.hostname + ":8000" + "/faye",{timeout:30});
    if($cookies.get("user")) {
        var subscription = fayeClient.subscribe("/" + $cookies.get("user"), function(message) {
            $rootScope.publishMessage(message.text);
        });
        $state.go("home");
    } else {
        $state.go("login");
        $rootScope.fact="User authorization through couchbase and ottoman user objects";
    }
});

travelApp.controller("LoginController", function($scope, $rootScope, $state, $http, md5, $cookies, jwtHelper) {
    $scope.login = function(username, password, isNew) {
        $cookies.remove("token");
        $cookies.remove("user");
        var cookieExpiration = new Date();
        cookieExpiration.setHours(cookieExpiration.getHours() + 4);
        if(isNew === true) {
            $rootScope.publishMessage("REST POST=/api/user/login");
            $http.post("/api/user/login",
                {
                    user: username,
                    password:md5.createHash(password)
                }
            )
            .then(function(response) {
                if(response.data.success) {
                    $scope.formData.error = null;
                    $cookies.put('token',response.data.success, {"expires": cookieExpiration});
                    $cookies.put('user',jwtHelper.decodeToken(response.data.success).user, {"expires": cookieExpiration});
                    var subscription = fayeClient.subscribe("/" + $cookies.get("user"), function(message) {
                        $rootScope.publishMessage(message.text);
                    });
                    $state.go("home");
                }
                if(response.data.failure) {
                    $scope.formData.error = response.data.failure;
                }
            }, function(error) {
                console.log(JSON.stringify(error));
            });
        } else {
            $rootScope.publishMessage("REST REQ=/api/user/login");
            $http.get("/api/user/login",
                {
                    params: {
                        user:username,
                        password:md5.createHash(password)
                    }
                }
            )
            .then(function(response) {
                if(response.data.success){
                    $scope.formData.error=null;
                    $cookies.put('token',response.data.success, {"expires": cookieExpiration});
                    $cookies.put('user',jwtHelper.decodeToken(response.data.success).user, {"expires": cookieExpiration});
                    var subscription = fayeClient.subscribe("/" + $cookies.get("user"), function(message) {
                        $rootScope.publishMessage(message.text);
                    });
                    $state.go("home");
                }
                if(response.data.failure) {
                    $scope.formData.error = response.data.failure;
                }
            }, function(error) {
                console.log(JSON.stringify(error));
            });
        }
    }
    $scope.toggleDebug = function() {
        $rootScope.showCode = !$rootScope.showCode;
    }
});

travelApp.controller("HomeController", function($scope, $rootScope, $state, $http, $cookies, $window, ngCart) {

    $scope.empty = true;

    $scope.findAirports = function(val) {
        $rootScope.fact="Typeahead bound to REST call: /api/airport/findAll";
        $rootScope.publishMessage("REST REQ=/api/airport/findAll");
        return $http.get("/api/airport/findAll",
            {
                params: {
                    search: val,
                    token: $cookies.get('token')
                }
            }
        )
        .then(function(response) {
            return response.data;
        });
    };
    $scope.findFlights = function(fromName, toName, departDate) {
        $rootScope.fact = "Searching for flights using REST call: /api/flightPath/findAll";
        $scope.rowCollectionLeave = [];
        $scope.rowCollectionRet = [];
        $scope.departDate = $("#leaveDate").val();
        $scope.returnDate = $("#retDate").val();
        $rootScope.publishMessage("REST REQ=/api/flightPath/findAll");
        $http.get("/api/flightPath/findAll",
            {
                params: {
                    from: fromName,
                    to: toName,
                    leave: $scope.departDate,
                    token:$cookies.get('token')
                }
            }
        )
        .then(function(response) {
            if (response.data.length > 0) {
                $scope.empty = false;
            }
            for (var j = 0; j < response.data.length; j++) {
                var d= new Date(Date.parse($scope.departDate + " " + response.data[j].utc));
                d.setHours(d.getHours()+response.data[j].flighttime);
                response.data[j].utcland = d.getHours() + ":" + d.getMinutes() + ":00";
                $scope.rowCollectionLeave.push(response.data[j]);
            }
        }, function(error) {
            console.log(JSON.stringify(error));
        });
        if($scope.returnDate) {
            $rootScope.publishMessage("REST REQ=/api/flightPath/findAll");
            $http.get("/api/flightPath/findAll",
                {
                    params: {
                        from: toName,
                        to: fromName,
                        leave: $scope.returnDate,
                        token:$cookies.get('token')
                    }
                }
            )
            .then(function(responseRet) {
                if (responseRet.data.length > 0) {
                    $scope.retEmpty = false;
                }
                for (var j = 0; j < responseRet.data.length; j++) {
                    var d= new Date(Date.parse($scope.ret + " " + responseRet.data[j].utc));
                    d.setHours(d.getHours()+responseRet.data[j].flighttime);
                    responseRet.data[j].utcland = d.getHours() + ":" + d.getMinutes() + ":00";
                    $scope.rowCollectionRet.push(responseRet.data[j]);
                }
            }, function(error) {
                console.log(JSON.stringify(error));
            });
        }
    };
    $scope.removeRow = function(row) {
        var index = $scope.rowCollectionLeave.indexOf(row);
        if (index !== -1) {
            $scope.rowCollectionLeave.splice(index, 1);
        }
    };
    $scope.selectRow = function(row) {
        $rootScope.fact="Native Angular Validation, choose OUTBOUND row ";
        $scope.rowCollectionLeave=[];
        $scope.rowCollectionLeave.push(row);
        row.date=$scope.departDate;
        ngCart.addItem(row.flight,row.name +"-"+row.flight,row.price,1,row);
        var tempRet=[];
        for (var k=0;k<$scope.rowCollectionRet.length;k++){
            if($scope.rowCollectionRet[k].name == row.name){
                tempRet.push($scope.rowCollectionRet[k]);
            }
        }
        $scope.rowCollectionRet=tempRet;
    };
    $scope.removeRowRet = function(row) {
        var index = $scope.rowCollectionRet.indexOf(row);
        if (index !== -1) {
            $scope.rowCollectionRet.splice(index, 1);
        }
    };
    $scope.selectRowRet = function(row) {
        $rootScope.fact="Native Angular Validation, choose INBOUND row ";
        $scope.rowCollectionRet=[];
        $scope.rowCollectionRet.push(row);
        row.date=$scope.returnDate;
        ngCart.addItem(row.flight,row.name +"-"+row.flight,row.price,1,row);
        var tempLeave=[];
        for (var j=0;j<$scope.rowCollectionLeave.length;j++){
            if($scope.rowCollectionLeave[j].name == row.name){
                tempLeave.push($scope.rowCollectionLeave[j]);
            }
        }
        $scope.rowCollectionLeave=tempLeave;
    };

    $('.input-daterange').datepicker(
        {
            "todayHighlight": true,
            "autoclose":true,
            "startDate":"+0d"
        }
    ).on("changeDate", function(ev) {
        var date = new Date(ev.date);
        //$scope.departDate = ev.date;
        //$rootScope.publishMessage("DATE SELECTED≔" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear());
        $("#textAreaShowMe").val("DATE SELECTED≔" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + "\n" + $("#textAreaShowMe").val());
    }).on("show",function(sh){
        $rootScope.fact="Selecting DATE from DatePicker";
    });

    $("input.switch").bootstrapSwitch({
                                          onText: '⇄',
                                          offText: '→',
                                          size: 'small',
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
                                          onText: 'on',
                                          offText: 'off',
                                          size: 'small',
                                          state: $rootScope.showCode
                                            });

    $("input.switchShowMe").on('switchChange.bootstrapSwitch', function(event, state) {
        $rootScope.showCode = state;
        $rootScope.$apply();
    });
});





travelApp.controller("UserController", function($rootScope, $scope, $http, $cookies) {

    $scope.rowCollectionFlight=[];

    $scope.findBookedFlights = function() {
        $rootScope.fact="Searching for previously booked flights";
        $rootScope.publishMessage("REST REQ=/api/user/flights");
        $http.get("/api/user/flights",
            {
                params: {
                    token: $cookies.get('token')
                }
            }
        )
        .then(function(responseFlights){
            if (responseFlights.data.length > 0) {
                $scope.fliEmpty = false;
            }
            for (var j = 0; j < responseFlights.data.length; j++) {
                $scope.rowCollectionFlight.push(responseFlights.data[j]);
            }
        });
    };

});
