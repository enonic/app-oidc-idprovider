const context = require("/lib/context");
const clusterLib = require("/lib/xp/cluster");
const initLib = require("/lib/configFile/initIdprovider");

if (clusterLib.isMaster()) {
    context.runAsSu(initLib.initUserStores)
}
