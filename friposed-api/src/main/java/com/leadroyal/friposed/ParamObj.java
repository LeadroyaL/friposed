package com.leadroyal.friposed;

public class ParamObj {
    public Object thisObj;
    public Object[] args;
    @InvokedByFrida
    private boolean returnEarly;
    @InvokedByFrida
    private Object result;

    public ParamObj(Object thisObj, Object[] args) {
        this.thisObj = thisObj;
        this.args = args;
    }

    public Object getResult() {
        return this.result;
    }

    public void setResult(Object result) {
        this.result = result;
        this.returnEarly = true;
    }
}
