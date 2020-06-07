Java.perform(function () {
    function loadApk(apkPath) {
        Java.openClassFile(apkPath).load();
    }
    function hasFile(fileName) {
        return Java.use("java.io.File").$new(fileName).exists();
    }
    function getPackagePath(pkgName) {
        return Java.use("android.app.ActivityThread").currentApplication().getPackageManager().getPackageInfo(pkgName, 0).applicationInfo.value.sourceDir.value;
    }
    function js2java(typeName, value) {
        // js boolean/number/Int64 -- > java boolean/byte/short/int/long/float/double
        switch (typeName) {
            case "Z":
                return Java.use("java.lang.Boolean").valueOf(value);
            case "B":
                return Java.use("java.lang.Byte").valueOf(value);
            case "S":
                return Java.use("java.lang.Short").valueOf(value);
            case "I":
                return Java.use("java.lang.Integer").valueOf(value);
            case "J":
                return Java.use("java.lang.Long").valueOf(value);
            case "F":
                return Java.use("java.lang.Float").valueOf(value);
            case "D":
                return Java.use("java.lang.Double").valueOf(value);
            default:
                return value;
        }
    }
    function java2js(typeName, value) {
        // java boolean/byte/short/int/long/float/double --> js boolean/number/Int64
        switch (typeName) {
            case "Z":
                return Java.cast(value, Java.use("java.lang.Boolean")).booleanValue();
            case "B":
                return Java.cast(value, Java.use("java.lang.Byte")).byteValue();
            case "S":
                return Java.cast(value, Java.use("java.lang.Short")).shortValue();
            case "I":
                return Java.cast(value, Java.use("java.lang.Integer")).intValue();
            case "J":
                return Java.cast(value, Java.use("java.lang.Long")).longValue();
            case "F":
                return Java.cast(value, Java.use("java.lang.Float")).floatValue();
            case "D":
                return Java.cast(value, Java.use("java.lang.Double")).doubleValue();
            default:
                return value;
        }
    }
    function readZipContent(zipPath, entryName) {
        var zipFile = Java.use("java.util.zip.ZipFile").$new(zipPath);
        var zipEntry = zipFile.getEntry(entryName);
        var fis = zipFile.getInputStream(zipEntry);
        var fakebs = new Array(fis.available());
        for (var index = 0; index < fakebs.length; index++) {
            fakebs[index] = 0;
        }
        var _bs = Java.array("byte", fakebs);
        fis.read(_bs);
        fis.close();
        zipFile.close();
        return Java.use("java.lang.String").$new(_bs).toString();
    }
    function findMatch(overloads, sig) {
        var sp = sig.split(",");
        for (var i in overloads) {
            var curArgumentTypes = overloads[i].argumentTypes;
            if (sp.length != curArgumentTypes.length)
                continue;
            for (var j in curArgumentTypes) {
                if (curArgumentTypes[j].className != sp[j]) {
                    continue;
                }
            }
            return overloads[i];
        }
    }
    function getPackageName() {
        return Java.use("android.app.ActivityThread").currentApplication().getPackageName();
    }

    // load plugin
    const LOCAL_APK_PATH = "/data/local/tmp/friposed.apk";
    const FRIPOSED_PKGNAME = "com.leadroyal.friposed";
    var dir;
    if (hasFile(LOCAL_APK_PATH)) {
        dir = LOCAL_APK_PATH;
    } else {
        dir = getPackagePath(FRIPOSED_PKGNAME);
    }
    var content = readZipContent(dir, "assets/friposed.json")
    loadApk(dir);

    var config = JSON.parse(content);
    var clz_ParamObj = Java.use("com.leadroyal.friposed.ParamObj");

    var currentPackageName = getPackageName();
    for (var configIndex in config) {
        if (config[configIndex].enable != undefined && !config[configIndex].enable) {
            console.log("[Disabled]. Skip:", config[configIndex].hookClassName);
            continue;
        }
        if (config[configIndex].targetPackage != currentPackageName) {
            console.log("[Mismatch]. Skip: target/current", config[configIndex].targetPackage, currentPackageName);
            continue;
        }
        var targetClassName = config[configIndex].targetClassName;
        var targetMethodSig = config[configIndex].targetMethodSig;
        var targetMethodName = targetMethodSig.split('(')[0];
        var targetMethodParam = targetMethodSig.split('(')[1];
        targetMethodParam = targetMethodParam.substring(0, targetMethodParam.length - 1);
        var targetMethod = findMatch(Java.use(targetClassName)[targetMethodName].overloads, targetMethodSig);
        var hookClassName = config[configIndex].hookClassName;
        var hook = Java.use(hookClassName).$new();
        startHook(targetMethod, hook);
    }

    function startHook(targetMethod, hook) {
        targetMethod.implementation = function () {
            // 将 js 的 arguments 处理为 java 的 Object[]，主要处理基本类型
            var argJsArray = Array(arguments.length);
            for (var i = 0; i < arguments.length; i++) {
                argJsArray[i] = js2java(targetMethod.argumentTypes[i].name, arguments[i]);
            }
            var argJavaArray = Java.array("java.lang.Object", argJsArray);

            // 根据是否static，决定是否传递this
            var isInstanceMethod = targetMethod.type == 3; // Java.MethodType.Instance
            var thisObject = null;
            if (isInstanceMethod)
                thisObject = this;

            var param_obj = clz_ParamObj.$new(thisObject, argJavaArray);

            // 调用before
            console.log("before invoked:", targetMethod.methodName);
            hook.beforeHook(param_obj);

            // 如果需要提前返回，就返回
            if (param_obj.returnEarly.value) {
                console.log("return early");
            } else {
                // 执行原先的方法
                // 将 Object[] 转为 frida传参的格式，主要处理基本类型
                var after_obj = param_obj.args.value;
                var invokeArray = Array(after_obj.length);
                for (var i = 0; i < after_obj.length; i++) {
                    invokeArray[i] = java2js(targetMethod.argumentTypes[i].name, after_obj[i]);
                }
                console.log("original invoked:", targetMethod.methodName);
                var ret = targetMethod.apply(this, invokeArray);

                // 将结果赋值给 param_obj
                var ret2js = js2java(targetMethod.returnType.name, ret);
                if (targetMethod.returnType.name == "V") {
                    // 如果函数的返回值声明为 void，不要设置param_obj.result，因为 frida 会报错
                } else {
                    param_obj.result.value = ret2js;
                }
            }

            // 调用after
            console.log("after invoked:", targetMethod.methodName);
            hook.afterHook(param_obj);

            // 如果函数的返回值声明为 void，返回undefined 表示返回void
            if (targetMethod.returnType.name == "V")
                return undefined;

            // 最终结果以 param_obj.result 为准，转为js认的基本类型
            return java2js(targetMethod.returnType.name, param_obj.result.value);
        };
    }
});