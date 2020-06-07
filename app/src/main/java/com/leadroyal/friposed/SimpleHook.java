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
