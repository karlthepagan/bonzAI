import {Mission} from "./Mission";
import {Operation} from "../operations/Operation";
import {Agent} from "./Agent";
import {InvaderGuru} from "./InvaderGuru";
export class BodyguardMission extends Mission {

    defenders: Agent[];
    hostiles: Creep[];

    memory: {}

    private invaderGuru: InvaderGuru;

    /**
     * Remote defense for non-owned rooms. If boosted invaders are likely, use EnhancedBodyguardMission
     * @param operation
     * @param invaderGuru
     * @param allowSpawn
     */

    constructor(operation: Operation, invaderGuru?: InvaderGuru, allowSpawn = true) {
        super(operation, "bodyguard", allowSpawn);
        this.invaderGuru = invaderGuru;
    }

    initMission() {
        if (!this.hasVision) return; // early
        this.hostiles = this.room.hostiles;
    }

    getBody = () => {
        let unit = this.configBody({
            tough: 1,
            move: 5,
            attack: 3,
            heal: 1
        });
        let potency = Math.min(this.spawnGroup.maxUnits(unit, 1), 3);
        return this.configBody({
            tough: potency,
            move: potency * 5,
            attack: potency * 3,
            heal: potency
        });
    };

    maxDefenders = () => {
        let maxDefenders = 0;
        if (this.invaderGuru && this.invaderGuru.invaderProbable) {
            maxDefenders = 1;
        }
        if (this.hasVision) {
            if (this.hostiles.length > 0) {
                maxDefenders = Math.ceil(this.hostiles.length / 2);
            }
            if (this.operation.type !== "mining" && this.room.findStructures(STRUCTURE_TOWER).length === 0) {
                maxDefenders = 1;
            }
        }
        return maxDefenders;
    };

    roleCall() {


        this.defenders = this.headCount2("leeroy", this.getBody, this.maxDefenders, { prespawn: 50 } );
    }

    missionActions() {

        for (let defender of this.defenders) {
            this.defenderActions(defender);
        }
    }

    finalizeMission() {
    }

    invalidateMissionCache() {
    }

    private defenderActions(defender: Agent) {
        if (!this.hasVision || this.hostiles.length === 0) {
            if (defender.hits < defender.hitsMax) {
                defender.heal(defender);
            }
            else {
                this.healHurtCreeps(defender);
            }
            return; // early
        }

        let attacking = false;
        let closest: Structure | Creep = defender.pos.findClosestByRange(this.hostiles);
        if (closest) {
            let range = defender.pos.getRangeTo(closest);
            if (range > 1) {
                defender.travelTo(closest);
            }
            else {
                attacking = defender.attack(closest) === OK;
                defender.move(defender.pos.getDirectionTo(closest));
            }
        }
        else {
            defender.travelTo(this.hostiles[0]);
        }

        if (!attacking && defender.hits < defender.hitsMax) {
            defender.heal(defender);
        }
    }

    private healHurtCreeps(defender: Agent) {
        let hurtCreep = this.findHurtCreep(defender);
        if (!hurtCreep) {
            defender.idleNear(this.flag, 12);
            return;
        }

        // move to creep
        let range = defender.pos.getRangeTo(hurtCreep);
        if (range > 1) {
            defender.travelTo(hurtCreep, {movingTarget: true});
        }
        else {
            defender.yieldRoad(hurtCreep, true);
        }

        if (range === 1) {
            defender.heal(hurtCreep);
        }
        else if (range <= 3) {
            defender.rangedHeal(hurtCreep);
        }
    }

    private findHurtCreep(defender: Agent) {
        if (!this.room) return;

        if (defender.memory.healId) {
            let creep = Game.getObjectById(defender.memory.healId) as Creep;
            if (creep && creep.room.name === defender.room.name && creep.hits < creep.hitsMax) {
                return creep;
            }
            else {
                defender.memory.healId = undefined;
                return this.findHurtCreep(defender);
            }
        }
        else if (!defender.memory.healCheck || Game.time - defender.memory.healCheck > 25) {
            defender.memory.healCheck = Game.time;
            let hurtCreep = _(this.room.find<Creep>(FIND_MY_CREEPS))
                .filter((c: Creep) => c.hits < c.hitsMax && c.ticksToLive > 100)
                .sortBy((c: Creep) => -c.partCount(WORK))
                .head();

            if (hurtCreep) {
                defender.memory.healId = hurtCreep.id;
                return hurtCreep;
            }
        }
    }
}