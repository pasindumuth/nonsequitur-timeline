export default class Database {
    static rawQuery(query) {
        return new Promise (function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('POST', '/db', true);
            request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            request.send("query=" + encodeURIComponent(query));
            request.onreadystatechange = function () {
                if (request.readyState === 4 && request.status === 200) {
                    var type = request.getResponseHeader('Content-Type');
                    if (type.indexOf("text") !== 1) {
                        resolve(request.responseText);;
                    }
                } else if (request.readyState === 4 && request.status === 500) {
                    reject("Database Error");
                }
            };
        });
    }
}
