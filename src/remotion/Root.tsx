import React from "react";
import { Composition, staticFile } from "remotion";
import { CampaignVideo, myCompSchema } from "./CampaignVideo";
import { getVideoMetadata } from "@remotion/media-utils";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CampaignVideo"
        component={CampaignVideo}
        schema={myCompSchema}
        calculateMetadata={async ({ props }) => {
          try {
            const templateFilename = props.templateFilename || "composicao-2.mp4";
            const metadata = await getVideoMetadata(staticFile(`templates/${templateFilename}`));
            return {
              durationInFrames: Math.floor(metadata.durationInSeconds * 30),
              fps: 30,
              width: metadata.width,
              height: metadata.height,
              props: {
                ...props,
              }
            };
          } catch (error) {
            console.error("Error reading video metadata in Root calculateMetadata:", error);
            // Fallback for dummy file
            return {
              durationInFrames: 15 * 30, // 15 sec * 30 fps
              fps: 30,
              width: 720,
              height: 1280,
              props: {
                ...props,
              }
            };
          }
        }}
        defaultProps={{
          name: "João da Silva",
          phone: "(11) 99999-9999",
        }}
      />
    </>
  );
};
