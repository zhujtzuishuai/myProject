// 此文件由 PackClientConfig 自动生成，请勿手动修改

declare namespace Cfg {
    /** @source DecorateInfo.csv */
    interface DecorateInfoCfg {
        /** 道具名 */
        name: string;
        /** 道具编号 */
        itemId: number;
        /** 图标 */
        icon: string;
        /** 模型或特效图标 */
        icon2: number;
        /** 特效配置 */
        effectCfg?: string;
        /** 单位 */
        unit: string;
        /** 品质 */
        color: string;
        /** 类型 */
        type: string;
        /** 描述 */
        descript: string;
        /** 来源 */
        sources: string;
        /** 特殊备注 */
        flag?: number;
        /** 额外参数 */
        extraParams?: string;
    }
}