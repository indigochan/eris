"use strict";

const Channel = require("./Channel");
const Collection = require("../util/Collection");
const Member = require("./Member");
const Message = require("./Message");
const Permission = require("./Permission");
const Permissions = require("../Constants").Permissions;
const PermissionOverwrite = require("./PermissionOverwrite");

/**
* Represents a guild channel
* @extends Channel
* @prop {String} mention A string that mentions the channel
* @prop {Guild} guild The guild that owns the channel
* @prop {Collection<Message>} messages Collection of Messages in this channel
* @prop {String} lastMessageID The ID of the last message in this channel
* @prop {Number} lastPinTimestamp The timestamp of the last pinned message
* @prop {Collection<PermissionOverwrite>} permissionOverwrites Collection of PermissionOverwrites in this channel
* @prop {Number} type The type of the channel, either 0 (text) or 2 (voice)
* @prop {String} name The name of the channel
* @prop {Number} position The position of the channel
* @prop {String?} topic The topic of the channel (text channels only)
* @prop {Number?} bitrate The bitrate of the channel (voice channels only)
* @prop {Number?} userLimit The max number of users that can join the channel (voice channels only)
* @prop {Boolean} nsfw Whether the channel is an NSFW channel or not
* @prop {Collection<Member>?} voiceMembers Collection of Members in this channel (voice channels only)
*/
class GuildChannel extends Channel {
    constructor(data, guild, messageLimit) {
        super(data);
        this.guild = guild;
        if(this.type === 2) {
            this.voiceMembers = new Collection(Member);
        } else {
            if(messageLimit == null && guild) {
                messageLimit = guild.shard.client.options.messageLimit;
            }
            this.messages = new Collection(Message, messageLimit);
            this.lastMessageID = data.last_message_id || null;
            this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
        }
        this.update(data);
    }

    update(data) {
        this.name = data.name !== undefined ? data.name : this.name;
        this.topic = data.topic !== undefined ? data.topic : this.topic;
        this.position = data.position !== undefined ? data.position : this.position;
        this.bitrate = data.bitrate !== undefined ? data.bitrate : this.bitrate;
        this.userLimit = data.user_limit !== undefined ? data.user_limit : this.userLimit;
        this.nsfw = this.type !== 2 && ((this.name.length === 4 ? this.name === "nsfw" : this.name.startsWith("nsfw-")) || data.nsfw);
        if(data.permission_overwrites) {
            this.permissionOverwrites = new Collection(PermissionOverwrite);
            data.permission_overwrites.forEach((overwrite) => {
                this.permissionOverwrites.add(overwrite);
            });
        }
    }

    /**
    * Get the channel-specific permissions of a member
    * @arg {String} memberID The ID of the member
    * @returns {Permission}
    */
    permissionsOf(memberID) {
        var member = this.guild.members.get(memberID);
        var permission = member.permission.allow;
        if(permission & Permissions.administrator) {
            return new Permission(Permissions.all);
        }
        var overwrite = this.permissionOverwrites.get(this.guild.id);
        if(overwrite) {
            permission = (permission & ~overwrite.deny) | overwrite.allow;
        }
        var deny = 0;
        var allow = 0;
        for(var roleID of member.roles) {
            if((overwrite = this.permissionOverwrites.get(roleID))) {
                deny |= overwrite.deny;
                allow |= overwrite.allow;
            }
        }
        permission = (permission & ~deny) | allow;
        overwrite = this.permissionOverwrites.get(memberID);
        if(overwrite) {
            permission = (permission & ~overwrite.deny) | overwrite.allow;
        }
        return new Permission(permission);
    }

    get mention() {
        return `<#${this.id}>`;
    }

    /**
    * Edit the channel's properties
    * @arg {Object} options The properties to edit
    * @arg {String} [options.name] The name of the channel
    * @arg {String} [options.topic] The topic of the channel (guild text channels only)
    * @arg {Number} [options.bitrate] The bitrate of the channel (guild voice channels only)
    * @arg {Number} [options.userLimit] The channel user limit (guild voice channels only)
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<GuildChannel>}
    */
    edit(options, reason) {
        return this.guild.shard.client.editChannel.call(this.guild.shard.client, this.id, options, reason);
    }

    /**
    * Edit the channel's position. Note that channel position numbers are lowest on top and highest at the bottom.
    * @arg {Number} position The new position of the channel
    * @returns {Promise}
    */
    editPosition(position) {
        return this.guild.shard.client.editChannelPosition.call(this.guild.shard.client, this.id, position);
    }

    /**
    * Delete the channel
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    delete(reason) {
        return this.guild.shard.client.deleteChannel.call(this.guild.shard.client, this.id, reason);
    }

    /**
    * Create a channel permission overwrite
    * @arg {String} overwriteID The ID of the overwritten user or role
    * @arg {Number} allow The permissions number for allowed permissions
    * @arg {Number} deny The permissions number for denied permissions
    * @arg {String} type The object type of the overwrite, either "member" or "role"
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<PermissionOverwrite>}
    */
    editPermission(overwriteID, allow, deny, type, reason) {
        return this.guild.shard.client.editChannelPermission.call(this.guild.shard.client, this.id, overwriteID, allow, deny, type, reason);
    }

    /**
    * Delete a channel permission overwrite
    * @arg {String} overwriteID The ID of the overwritten user or role
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deletePermission(overwriteID, reason) {
        return this.guild.shard.client.deleteChannelPermission.call(this.guild.shard.client, this.id, overwriteID, reason);
    }

    /**
    * Get all invites in the channel
    * @returns {Promise<Invite[]>}
    */
    getInvites() {
        return this.guild.shard.client.getChannelInvites.call(this.guild.shard.client, this.id);
    }

    /**
    * Create an invite for the channel
    * @arg {Object} [options] Invite generation options
    * @arg {Number} [options.maxAge] How long the invite should last in seconds
    * @arg {Number} [options.maxUses] How many uses the invite should last for
    * @arg {Boolean} [options.temporary] Whether the invite is temporary or not
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Invite>}
    */
    createInvite(options, reason) {
        return this.guild.shard.client.createChannelInvite.call(this.guild.shard.client, this.id, options, reason);
    }

    /**
    * Get all the webhooks in the channel
    * @returns {Promise<Object[]>} Resolves with an array of webhook objects
    */
    getWebhooks() {
        return this.guild.shard.client.getChannelWebhooks.call(this.guild.shard.client, this.id);
    }

    /**
    * Create a channel webhook
    * @arg {Object} options Webhook options
    * @arg {String} options.name The default name
    * @arg {String} options.avatar The default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    createWebhook(options, reason) {
        return this.guild.shard.client.createChannelWebhook.call(this.guild.shard.client, this.id, options, reason);
    }

    /**
    * Bulk delete messages (bot accounts only)
    * @arg {String[]} messageIDs Array of message IDs to delete
    * @returns {Promise}
    */
    deleteMessages(messageIDs) {
        return this.guild.shard.client.deleteMessages.call(this.guild.shard.client, this.id, messageIDs);
    }

    /**
    * Purge previous messages in the channel with an optional filter (bot accounts only)
    * @arg {Number} limit The max number of messages to search through, -1 for no limit
    * @arg {function} [filter] Optional filter function that returns a boolean when passed a Message object
    * @arg {String} [before] Get messages before this message ID
    * @arg {String} [after] Get messages after this message ID
    * @returns {Promise<Number>} Resolves with the number of messages deleted
    */
    purge(limit, filter, before, after) {
        return this.guild.shard.client.purgeChannel.call(this.guild.shard.client, this.id, limit, filter, before, after);
    }
}

module.exports = GuildChannel;
