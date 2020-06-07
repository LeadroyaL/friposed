# friposed —— Write java hook with frida

`friposed = frida + xposed`，字面意思，本来想借助 frida 实现一套完整的 xposed 支持，但由于代价实在太高，于是只能写一套简单的实现。

### 一句话用途

在 frida 可用时，使用 java 写 hook。 

### 背景

在2017年初，刚接触 frida 时，我就一直在吐槽 frida hook java 的反人类设计，并不是说 frida 项目不好，而是用 js 这种弱类型语言去描述和操作强类型的 java，在 js 里写 java hook 体验很差，本身就是不优雅的。（而且我那台手机用 frida 经常 crash。）

0202年已经过去一半了，不怎么使用 frida。看身边小伙伴在用 frida 而不是 xposed，感觉自己落伍了，不够 fashion，于是突发奇想写了这个项目，使用 frida 作为桥梁，提供在 java 里写 hook 的能力，**从而让像我这样“半截入土”的 xposed 开发者仍然可以苟活在 frida 的环境里**。

并且对于仅拥有root、未拥有xposed的环境，提供了使用java hook的办法。

### Demo体验方法

demo就是 `friposed.apk` 本身，实现对自己的 hook，可阅读配置文件来理解它`assets/friposed.json`。

1. 安装并运行 APP，配好 frida 环境
2. `frida -U -l friposed.js com.leadroyal.friposed`
3. 点击桌面上的 button，观察命令行的输出，观察 logcat 的输出，预期结果如下

```java
package com.leadroyal.friposed;

import android.util.Log;

public class SimpleHook implements IHook {
    private static final String TAG = "SimpleHook";

    @Override
    public void beforeHook(ParamObj paramObj) {
        for (int i = 0; i < paramObj.args.length; i++) {
            if (paramObj.args[i] == null)
                Log.e(TAG, "args[" + i + "]=" + "null@null");
            else
                Log.e(TAG, "args[" + i + "]=" + paramObj.args[i] + "@" + paramObj.args[i].getClass());
        }
    }

    @Override
    public void afterHook(ParamObj paramObj) {
        Log.e(TAG, "return " + paramObj.getResult());
    }
}

```

```
> frida
[Redmi 8A::com.leadroyal.friposed]-> before invoked: func
original invoked: func
after invoked: func

> logcat
SimpleHook: args[0]=Click Me!@class java.lang.String
SimpleHook: args[1]=123@class java.lang.Integer
MainActivity: Click Me!	123
SimpleHook: return null
```

### 基础用法

1. 打开本项目里的安卓工程 `com.leadroyal.friposed` ，按需修改 `assets/friposed.json`，并且创建对应实现了 `com.leadroyal.friposed.IHook`的类。

    ```json
    [
      {
        "enable": true,
        "targetPackage": "com.leadroyal.friposed",
        "targetClassName": "com.leadroyal.friposed.MainActivity",
        "targetMethodSig": "func(java.lang.String,int)",
        "hookClassName": "com.leadroyal.friposed.SimpleHook"
      }
    ]
    ```

2. 开发自定义的 Hook（一定要实现 IHook这个接口）。提供基础功能：在`beforeHook`和`afterHook` 对 arguments 进行读写，对 result 进行读写，从而实现`XC_MethodHook`，使用 setResult 实现 `XC_MethodReplacement`。
3. 安装 `friposed.apk` 或者 `adb push friposed.apk /data/local/tmp/`，
4. `frida -U friposed.js TARGET_PACKAGE_NAME`

### 实现原理

使用 frida-cli 进行 attach 后，加载 `com.leadoryal.friposed` 这个 apk，访问内部的 `assets/friposed.json` 配置文件，寻找对应的 class 和 method进行 hook，依次执行这几步操作：

1. 调用前的参数传递给 apk 里的 hook 类的 `beforeMethod`，此时可修改参数和返回值
2. 调用原先的实现或者提前返回
3. 将参数和返回值传递给 apk 里 hook 类的 `afterMethod`，此时同样可修改参数和返回值
4. js 将结果返回

### 高级用法

- 不安装 APP 来加载 friposed

	friposed 会先访问 `/data/local/tmp/friposed.apk`，将 apk 文件放到该位置即可，也可以修js改代码的`LOCAL_APK_PATH`使用其他位置的 apk。

- 使用其他包名

	修改 js 代码的`FRIPOSED_PKGNAME`使用其他包名作为 friposed 的入口，但一定要保证下面三个文件还存在，建议将`friposed-api`这个 gradle 项目打包带走：
	- com.leadroyal.friposed.ParamObj
	- com.leadroyal.friposed.IHook
	- assets/friposed.json


### 其他

这真的只是个小项目，是我第一个 frida 项目也应该是最后一个 frida 项目，因此请不要对它抱有过高的期望，有 bug 和需求请提出来。