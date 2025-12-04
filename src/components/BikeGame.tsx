"use client";

import React, {useEffect, useRef, useState} from "react";
import Phaser from "phaser";
import {WelcomeScene} from "@/scence/WelcomeScene";
import BackgroundGarageScene from "@/scence/BackgroundGarageScene";
import BackgroundScrollScene from "@/scence/BackgroundScrollScene";
import BikeScene from "@/scence/BikeScene";
import {HomeScene} from "@/scence/HomeScene";
import GuideScene from "@/scence/GuideScene";
import BootScene from "@/scence/BootScene";

export default function BikeGame() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const outerContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Avoid creating multiple instances on Fast Refresh
        if (gameRef.current) {
            return () => {
                gameRef.current?.destroy(true);
                gameRef.current = null;
            };
        }

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: 1080,
            height: 1920,
            backgroundColor: "#000000",
            scene: [BootScene, WelcomeScene, HomeScene, BackgroundGarageScene, BackgroundScrollScene, BikeScene, GuideScene],
            physics: {default: "arcade"},
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        return () => {
            game.destroy(true);
            gameRef.current = null;
        };
    }, []);

    return (
        <div
            ref={outerContainerRef}
            className="w-full sm:max-w-3xl aspect-[9/16] sm:aspect-[16/9]"
        >
            <div
                ref={containerRef}
                className="w-full h-full"
            />
        </div>
    );
}
