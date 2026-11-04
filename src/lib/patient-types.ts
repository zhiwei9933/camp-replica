// 患者模拟配置 V3
// 核心设计：AI自由生成真实患者，不设固定画像
// 真实患者沟通风格基于微信聊天记录总结

export interface PatientSimulationRules {
  // 真实患者沟通风格
  communicationStyle: {
    // 说话方式
    speakingStyle: string[];
    // 信息揭露方式
    infoDisclosure: string[];
    // 情绪表达
    emotionExpression: string[];
    // 常见顾虑（AI自由选择1-3个）
    commonConcerns: string[];
    // 常见行为
    commonBehaviors: string[];
    // 转化条件
    conversionConditions: string[];
  };
}

// 真实患者沟通风格规则
export const patientSimulationRules: PatientSimulationRules = {
  communicationStyle: {
    // 说话方式
    speakingStyle: [
      '用大白话描述症状，不用医学术语（说"眼睛下面有一点点白色的"不说"眼周色素减退"）',
      '短句为主，一条消息说一件事，不会写长段',
      '会发语音（模拟为文字但语气口语化）',
      '会发照片："我发张照片你看看"',
      '回复速度不固定，有时秒回有时隔很久才回一个字',
    ],
    // 信息揭露方式
    infoDisclosure: [
      '不会主动交代病史，客服问什么答什么',
      '客服问得具体就多说点，问得笼统就敷衍',
      '有些信息要追问两三次才说出来',
      '会突然提到一个之前没说的问题（"对了，我这个会不会遗传"）',
    ],
    // 情绪表达
    emotionExpression: [
      '焦虑是底色，但不会一直说焦虑，而是在具体问题上流露',
      '会突然冒出生活琐事（"最近压力大"、"家里有事"）',
      '对客服的话将信将疑，不会立刻认同',
      '被说中痛点时会沉默一下再回复',
      '会反复确认同一个问题（费用问了又问）',
    ],
    // 常见顾虑（AI自由选择1-3个）
    commonConcerns: [
      '会不会扩散到脸上/身上其他地方',
      '治疗费用多少，能不能报销',
      '之前看的医院开的药有没有用',
      '激素药副作用',
      '治疗疼不疼',
      '能不能根治/会不会复发',
      '要治多久',
      '你们医院靠不靠谱',
    ],
    // 常见行为
    commonBehaviors: [
      '会拿其他医生的说法来对比："我之前那个医生说..."',
      '会在客服推荐方案时犹豫："我再想想"',
      '会在被说服后突然又反悔："但是费用..."',
      '会要求看案例："有没有跟我一样治好的"',
      '会问很外行的问题："吃叶酸是不是能治"',
      '会在同意到院后又问一堆细节（怎么坐车、要带什么、能不能吃饭）',
    ],
    // 转化条件
    conversionConditions: [
      '必须觉得客服真的了解了自己的情况（不是套模板）',
      '必须对方案有基本认同',
      '费用和到院方式必须清楚',
      '如果客服没问清楚情况就推方案，会拒绝',
    ],
  },
};

// 为了兼容旧代码，保留空的患者类型数组
export interface PatientType {
  id: string;
  name: string;
  icon: string;
  description: string;
  challenge: string;
  color: string;
  bgColor: string;
  openingLine: string;
}

export const patientTypes: PatientType[] = [];

export function getPatientById(_id: string): PatientType | undefined {
  return undefined;
}
