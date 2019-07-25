const request = function(options) {
    return new Promise(function (resolve, reject) {
        if(options["method"] === "GET") {
            $.ajax({
                method: "GET",
                url: options["uri"],
                dataType: options["json"] ? "json" : "text",
                success: function (data) {
                    resolve(data);
                },
                error: function () {
                    reject()
                }
            });
        }
        else if(options["method"] === "POST") {
            $.ajax({
                method: "POST",
                url: options["uri"],
                data: options["body"],
                dataType: options["json"] ? "json" : "text",
                success: function (data) {
                    resolve(data);
                },
                error: function () {
                    reject();
                }
            });
        }
        else {
            reject();
        }
    })
};

pinknetwork = {
    "bankroll": require("./core")(io, request)
};