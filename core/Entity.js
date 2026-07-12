export default class Entity {
    id;
    x;
    y;
    size;
    name;
    color;
    skinName;
    accountID;
    isMine;
    isFood;
    isVirus;
    isFriend;
    agitated;
    indexInList;
    constructor(id, accountID) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.size = 0;
        this.name = '';
        this.color = '';
        this.skinName = '';
        this.isMine = false;
        this.isFood = false;
        this.isVirus = false;
        this.agitated = false;
        this.isFriend = false;
        this.accountID = accountID;
        this.indexInList = undefined;
    }
    destroy(bot) {
        delete bot.myCellIds[this.id];
        delete bot.playerCells[this.id];
        
        if (this.indexInList !== undefined && bot.playerCellsList) {
            const list = bot.playerCellsList;
            const lastCell = list[list.length - 1];
            if (lastCell) {
                list[this.indexInList] = lastCell;
                lastCell.indexInList = this.indexInList;
            }
            list.pop();
            this.indexInList = undefined;
        }

        const index = bot.ownCells.indexOf(this);
        if (index !== -1)
            bot.ownCells.splice(index, 1);
    }
}
