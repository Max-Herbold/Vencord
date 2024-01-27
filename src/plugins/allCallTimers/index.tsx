/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";

import { Timer } from "./Timer";

const VoiceStateStore = findStoreLazy("VoiceStateStore");

export const settings = definePluginSettings({
    alwaysShow: {
        type: OptionType.BOOLEAN,
        description: "Always show the timer or have it as a tooltip icon",
        restartNeeded: false,
        default: false
    },
});

export default definePlugin({
    name: "AllCallTimers",
    description: "Add call timer to all users in a server voice channel.",
    authors: [Devs.Max, Devs.D3SOX],

    settings,

    patches: [
        {
            find: "renderPrioritySpeaker",
            replacement: [
                {
                    match: /(render\(\)\{.+\}\),children:)\[(.+renderName\(\),)/,
                    replace: "$&$self.showInjection(this),"
                }
            ]
        }
    ],

    allUsers(guilds: Record<string, any>) {
        // return an array of all users in all guilds
        const users: string[] = [];
        for (const guildId in guilds) {
            const guild = guilds[guildId];
            for (const userId in guild) {
                users.push(userId);
            }
        }
        return users;
    },

    updateListings() {
        const states = VoiceStateStore.getAllVoiceStates();

        const currentUsers = this.allUsers(states);
        for (const userId in this.users) {
            if (!currentUsers.includes(userId)) {
                delete this.users[userId];
            }
        }

        // states is an array of {guildId: {userId: {channelId: channelId}}}
        // iterate through all guilds and update the users, check if the user is in the same channel as before
        // if userId is not in any guild it should be deleted from the users object
        for (const guildId in states) {
            const guild = states[guildId];
            for (const userId in guild) {
                const { channelId } = guild[userId];
                if (!channelId) {
                    return;
                }
                if (this.users[userId]) {
                    // user is already in the users object
                    if (this.users[userId].channelId !== channelId) {
                        // user changed the channel
                        this.users[userId].channelId = channelId;
                        this.users[userId].joinTime = Date.now();
                    }
                } else {
                    // user is not in the users object
                    this.users[userId] = {
                        channelId: channelId,
                        joinTime: Date.now()
                    };
                }
            }
        }
    },

    start() {
        this.users = {};

        // start a timeout that runs every second and calls updateListings
        this.timeout = setInterval(() => this.updateListings(), 1000);
    },

    stop() {
        // clear the timeout
        clearInterval(this.timeout);
    },

    showInjection(property: { props: { user: { id: string; }; }; }) {
        const userId = property.props.user.id;

        if (VoiceStateStore == null) {
            console.log("VoiceStateStore is null");
            return;
        }

        return this.renderTimer(userId);
    },

    renderTimer(userId: string) {
        // get the user from the users object
        const user = this.users[userId];
        if (!user) {
            return;
        }
        const startTime = user.joinTime;

        return (
            <ErrorBoundary>
                <Timer time={startTime} />
            </ErrorBoundary>
        );
    },
});