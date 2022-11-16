const context = require("/lib/context");
const clusterLib = require("/lib/xp/cluster");
const taskLib = require("/lib/xp/task");
const initLib = require("/lib/initIdprovider");

if (clusterLib.isMaster()) {
    context.runAsSu(function () {
        taskLib.executeFunction({
            description: app.name + ": create userstore(s)",
            func: initLib.initUserStores,
        });
    });
}
