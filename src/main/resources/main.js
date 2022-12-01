const context = require("/lib/context");
const clusterLib = require("/lib/xp/cluster");
const initLib = require("/lib/configFile/initIDProvider");

if (clusterLib.isMaster()) {
    context.runAsSu(initLib.initUserStores)
}
