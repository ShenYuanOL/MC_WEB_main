/**
 * 作者:Yoyo 
 * 功能:链式数据库操作
 * 版本:v2.0.6(全预处理版本) 安全性提升|防注入 (execute改善版本)
 * 说明:使用本库,请保留自带打印说明! 否则请勿使用,我不喜欢不尊重别人劳动成果的人
 */
class sqlite {

    static params = {
        path: null,/*数据库文件地址*/
        create: true,/* 不存在是否自动创建 */
        readwrite: true/*以读写模式打开*/
    };//数据库配置

    static table_prefix = '';//表的前缀
    static isShowSql = false;//是否打印显示生成sql

    static link = null;//打开的数据库对象

    /* sql配置项每个实例私有的 */
    #sqloptions = {
        result: true,//最终结果(有一项错误将设置false|在结尾操作拦截返回false)
        table: null,
        alias: '',//表的别名 table+' '+alias
        field: [],//字段
        join: [],//join多表连查[  ['table a','a.id = b.id','INNER JOIN'] ] [表,条件,类型]
        where: {
            sql: [],//生成的sql或者是预处理的值 是一个数组
            bindValue: [],//预处理需要绑定的值
        },
        group: '',//分组
        having: '',//筛选分组(使用它必须要有group)
        order: [],//排序 
        limit: '',//限制字段
        insert: {
            field: [],//字段[a,b,c]
            value: []//值 [[a,b,c,...]]
        },//插入的值 
        update: {
            field: [],//需要设置的字段
            bindValue: []//设置的值
        },//需要更新的值
    };


    /**
     * 连接数据库并配置()
     * @param {object|string} params|path
     * @returns {boolean}
     */
    static connectDb(params) {
        if (typeof params == 'string' && params != '') {
            params = { path: params };
        }
        if (typeof params != 'object') {
            logger.error('It should be a path or object configuration!');
            return false;/* 应该是对象配置或者path字符串 */
        }
        if (typeof params.prefix == 'string' && params.prefix != '') {
            sqlite.table_prefix = params.prefix;//设置表前缀
            delete params.prefix;//删除它
        }
        sqlite.params = { ...sqlite.params, ...params };
        /* 如果文件不存在先创建它所在目录 */
        if (!File.exists(sqlite.params.path)) {
            // 创建文件夹
            let mkdirName = sqlite.params.path.replace(/^(.+)[\\\/]+[^\.]+\.db$/, '$1');
            File.mkdir(mkdirName);
        }
        sqlite.link = new DBSession('sqlite3', sqlite.params);
        return sqlite.link == null ? false : true;
    }

    /**
     * 判断指定表名是否存在
     * @param {String} name 
     */
    static isTable(name) {
        let result = sqlite.link.query("select count(*) count from sqlite_master where type='table' and name='" + name + "';");
        return result[1][0] > 0 ? true : false;
    }

    /**
     * 删除指定表
     * @param {string} name 表名
     */
    static delTable(name) {
        sqlite.link.execute("DROP TABLE " + name + ";");
    }

    /**
     * 清空指定表
     * @param {String} name 表名
     */
    static clearTable(name) {
        sqlite.link.execute("delete from " + name + ";");
        sqlite.link.execute("update sqlite_sequence SET seq = 0 where name ='" + name + "';");
    }

    /**
     * 创建数据表
     * @param {string} name 表名
     * @param {object} options 字段配置
     * @returns {boolean}
     */
    static createTable(name, options = null) {
        if (sqlite.link == null) {
            logger.error('Unlinked database!');
            return false;/* 未连接数据库 */
        }
        let sql = "CREATE TABLE IF NOT EXISTS " + name + " (";
        /* 是对象说明还有其它配置否则就是id默认表 */
        if (typeof options == 'object' && options != null) {
            let keyArr = Object.keys(options);
            let fieldArr = keyArr.map(key => {
                if (typeof options[key] == 'string' && options[key] != '') {
                    /* 直接是字符串就类型(默认值null) */
                    return key + " " + options[key] + " null";
                } else if (typeof options[key] == 'object' && !Array.isArray(options[key]) && options[key] != null) {
                    /* 是对象不是数组才对此进行操作 */
                    if (options[key].key) {
                        /* 如果是主键将忽悠其它参数 */
                        let auto = ' autoincrement';
                        if (typeof options[key].auto == 'boolean' && !options[key].auto) {
                            auto = '';//不需要自增
                        }
                        return key + " integer primary key " + auto;
                    }
                    return String(key + (options[key].type ? ' ' + options[key].type : '') + (options[key].default ? ' ' + options[key].default : ' null') + (options[key].unique ? ' unique' : ''));

                }
            });
            sql += fieldArr.join(',');
        } else {
            /* 没有字段配置就是默认id自增长的表 */
            sql += 'id  integer primary key autoincrement';
        }
        sql += ');';
        return sqlite.link.execute(sql);
    }

    /**
     * 选中表名(每条操作的起步)
     * @param {string} table 需要操作的表名(完整 表名)
     * @returns {object} this
     */
    static table(table) {
        if (typeof table != 'string' || table == '') {
            this.#sqloptions.result = false;//失败(在结尾操作拦截返回false)
            logger.error('Please provide a valid string table name!');
            return new this;/* 您任然可以链式但是最后会返回false */
        }
        return new this(table);/* 返回一个新的实例每个实例互不影响 */
    }

    /**
     * 选中表名(每条操作的起步)(自动组合前缀)
     * @param {string} table 需要操作的表名(会组合前缀)
     * @returns {object} this
     */
    static name(table) {
        if (typeof table != 'string' || table == '') {
            this.#sqloptions.result = false;//失败(在结尾操作拦截返回false)
            logger.error('Please provide a valid string table name!');
            return new this;/* 您任然可以链式但是最后会返回false */
        }
        return new this(`${sqlite.table_prefix}${table}`);/* 返回一个新的实例每个实例互不影响 */
    }

    /* 构造方法 */
    constructor(table = null) {
        /* 设置需要操作的表名 */
        this.#sqloptions.table = table;
    }

    /* 中间的方法 */

    /**
     * 添加条件(字符串会自动加单引号)
     * @param  {...any} ages 条件
     * @returns {object} this
     */
    where(...ages) {
        /**
         * 只有一个参数
         */
        if (ages.length == 1) {
            if (typeof ages[0] == 'string') {
                //字符串查询语句 自由组合 多个任然是 AND
                this.#sqloptions.where.sql.push(ages[0]);//加入条件值
            } else if (typeof ages[0] == 'object' && !Array.isArray(ages[0])) {
                //键对值条件(对象)(条件是=对等)  AND
                let arr = [];//存储
                Object.keys(ages[0]).forEach(key => {
                    // if (typeof ages[0][key] == 'string') ages[0][key] = `'${ages[0][key]}'`;//字符增加单引号
                    arr.push(key + " = ?");//加入数组
                    this.#sqloptions.where.bindValue.push(ages[0][key]);//加入条件值
                });
                this.#sqloptions.where.sql.push(arr.join(' AND '));//加入条件值

            } else if (Array.isArray(ages[0])) {
                //数组类型,二维的[['id','>=',5],['name','=','yoyo']] AND
                let arr = [];//存储
                ages[0].forEach(value => {
                    if (Array.isArray(value) && value.length > 1) {
                        if (value.length == 2) value.splice(1, 0, '=');//如果只有两个默认就是 =
                        // if (typeof value[2] == 'string') value[2] = `'${value[2]}'`;//字符增加单引号
                        if (/^(not)?\s?in$/i.test(value[1])) {
                            arr.push(value[0] + " " + value[1] + "(" + value[2].map(v => {
                                if (typeof v == 'string') v = `'${v}'`;//字符增加单引号
                                return v;
                            }).join(',') + ")");//加入条件
                        } else {
                            arr.push(value[0] + " " + value[1] + " ?");//加入数组
                            this.#sqloptions.where.bindValue.push(value[2]);//加入条件值
                        }


                    }
                });
                this.#sqloptions.where.sql.push(arr.join(' AND '));//加入条件值
            }
        } else if (ages.length == 2) {
            //两个参数 字段,值 关系  =
            // if (typeof ages[1] == 'string') ages[1] = `'${ages[1]}'`;//字符增加单引号
            this.#sqloptions.where.sql.push(ages[0] + " = ?");//加入条件
            this.#sqloptions.where.bindValue.push(ages[1]);//加入值
        } else if (ages.length == 3) {
            //三个参数 字段,条件,值
            if (ages[1] == '') ages[1] = '=';//如果是空的默认 =
            // if (typeof ages[2] == 'string') ages[2] = `'${ages[2]}'`;//字符增加单引号
            if (/^(not)?\s?in$/i.test(ages[1])) {
                this.#sqloptions.where.sql.push(ages[0] + " " + ages[1] + "(" + ages[2].map(v => {
                    if (typeof v == 'string') v = `'${v}'`;//字符增加单引号
                    return v;
                }).join(',') + ")");//加入条件
                return this;
            }
            this.#sqloptions.where.sql.push(ages[0] + " " + ages[1] + " ?");//加入条件
            this.#sqloptions.where.bindValue.push(ages[2]);//加入值
        }

        return this;
    }

    /**
     * 条件未加工
     * @param {string} sql 
     * @param {Array|String|Number} bind 
     */
    whereRaw(sql, bind = null) {
        if (typeof sql == 'undefined') {
            this.#sqloptions.result = false;//失败(在结尾操作拦截返回false)
            logger.error('WhereRaw SQL cannot be undefined');
            return this;/* 您任然可以链式但是最后会返回false */
        }
        this.#sqloptions.where.sql.push(sql);
        if (bind != null) {
            if (typeof bind == 'number' || typeof bind == 'string') {
                this.#sqloptions.where.bindValue.push(bind);//加入值
            } else if (this.#isArrayData(bind)) {
                bind.forEach(v => {
                    this.#sqloptions.where.bindValue.push(v);//加入值
                });
            }
        }
        return this;
    }

    /**
     * 给表取别名 就是 as
     * @param {string} name 别名
     */
    alias(name = '') {
        this.#sqloptions.alias = name;
        return this;
    }

    /**
     * 设置字段
     * @param {Array|string} field 字段数组或者字符串
     */
    field(field = '*') {
        if (Array.isArray(field)) {
            //数组
            this.#sqloptions.field.push(field.join(','));//加入字段
        } else if (typeof field == 'string' && field != '') {
            //字符串
            this.#sqloptions.field.push(field);//加入字段
        }
        return this;
    }

    /**
     * 限制条数
     * @param  {Number} 显示的条数|起始位置  
     * @param  {Number} 显示的条数
     */
    limit(...ages) {
        if (ages.length == 1) {
            this.#sqloptions.limit = parseInt(ages[0]);
        } else if (ages.length == 2) {
            this.#sqloptions.limit = `${parseInt(ages[0])},${parseInt(ages[1])}`;
        }
        return this;
    }

    /**
     * 排序
     * @param {...any} ages 字段 默认asc 升序
     */
    order(...ages) {
        if (ages.length == 1 && typeof ages[0] == 'string' && ages[0] != '') {
            this.#sqloptions.order.push(ages[0]);//加入排序字段
        } else if (ages.length == 2 && typeof ages[0] == 'string' && ages[0] != '') {
            if (ages[1].toLowerCase() != 'desc') ages[1] = '';
            this.#sqloptions.order.push(ages[0] + " " + ages[1]);//加入排序字段
        } else if (ages.length == 1 && typeof ages[0] == 'object') {

        }
        return this;
    }

    /**
     * 分组
     * @param {string} fields 字段多个逗号
     */
    group(fields) {
        if (typeof fields == 'string' && fields != '') {
            this.#sqloptions.group = fields;//设置分组
        }
        return this;
    }

    /**
     * 筛选分组的数据
     * @param {string} str 条件
     */
    having(str) {
        if (this.#sqloptions.group == '') {
            logger.warn('Having must be used with groups!');
        } else {
            this.#sqloptions.having = str;//设置筛选分组
        }
        return this;
    }

    /**
     * 多表联查[等值查询](INNER JOIN)
     * @param {string} table 表
     * @param {string} where 条件
     */
    join(table = '', where = '') {
        return this.#pushJoinData(table, where, 'INNER JOIN');
    }

    /**
     * 多表联查[左查询](LEFT JOIN)
     * @param {string} table 表
     * @param {string} where 条件
     */
    leftJoin(table, where) {
        return this.#pushJoinData(table, where, 'LEFT JOIN');
    }

    /**
     * 多表联查[右查询](RIGHT JOIN)
     * @param {string} table 表
     * @param {string} where 条件
     */
    rightJoin(table, where) {
        return this.#pushJoinData(table, where, 'RIGHT JOIN');
    }

    /**
     * 多表联查[一个匹配填充null返回](FULL JOIN)
     * @param {string} table 表
     * @param {string} where 条件
     */
    fullJoin(table, where) {
        return this.#pushJoinData(table, where, 'FULL JOIN');
    }

    /**
     * 添加join
     * @param {string} table 表
     * @param {string} where 条件
     * @param {string} type 类型
     */
    #pushJoinData(table, where, type) {
        if (table == '' || where == '') {
            this.#sqloptions.result = false;//失败(在结尾操作拦截返回false)
            logger.error('The join parameter is missing!');
            return this;
        }
        this.#sqloptions.join.push([table, where, type]);//加入
        return this;
    }


    /* 结尾操作 */

    /**
     * 添加数据
     * @param {object|Array} data 数据(单条或者多条)
     * @returns {boolean}
     */
    insert(data) {
        if (!this.#sqloptions.result) return false;//拦截


        if (typeof data == 'object' && !Array.isArray(data)) {
            //对象 单条带字段
            let values = [];
            for (let key in data) {
                this.#sqloptions.insert.field.push(key);//设置字段
                // if (typeof data[key] == 'string') data[key] = `'${data[key]}'`;//字符增加单引号
                values.push(data[key]);//设置值
            }
            this.#sqloptions.insert.value.push(values);//设置值 二维数组
        } else if (Array.isArray(data) && data.length > 0) {
            //数组
            if (this.#isTwoArray(data)) {
                //多条不带字段(值数量得一样)
                if (this.#sqloptions.field < 1) {
                    logger.error('You should set the field separately if you do not point to the field!');
                    return false
                }
                this.#sqloptions.insert.field = this.#sqloptions.field;//设置字段
                for (let key in data) {
                    for (let i = 0; i < data[0].length; i++) {
                        // if (typeof data[key][i] == 'string') data[key][i] = `'${data[key][i]}'`;//字符增加单引号
                        if (typeof data[key][i] == 'undefined') data[key][i] = 'null';//少了设置null填充
                    }
                    this.#sqloptions.insert.value.push(data[key]);//设置值 二维数组
                }
            } else if (this.#isArrayObj(data)) {
                //多条带字段名的(字段必须一样)
                let fields = Object.keys(data[0]);
                this.#sqloptions.insert.field = fields;//设置字段
                for (let key in data) {
                    let values = [];
                    for (let i = 0; i < fields.length; i++) {
                        // if (typeof data[key][fields[i]] == 'string') data[key][fields[i]] = `'${data[key][fields[i]]}'`;//字符增加单引号
                        if (typeof data[key][fields[i]] == 'undefined') data[key][fields[i]] = 'null';//设置少的值未null
                        values.push(data[key][fields[i]]);//设置值
                    }
                    this.#sqloptions.insert.value.push(values);//设置值 二维数组
                }
            } else if (this.#isArrayData(data)) {
                //不带字段名的单条
                if (this.#sqloptions.field < 1) {
                    logger.error('You should set the field separately if you do not point to the field!');
                    return false
                }
                this.#sqloptions.insert.field = this.#sqloptions.field;//设置字段
                data = data.map(v => {
                    // if (typeof v == 'string') v = `'${v}'`;//字符增加单引号
                    return v;
                });
                this.#sqloptions.insert.value = [data];//设置值 二维数组
            }
        } else { return false; }
        let sql = this.generateSql('INSERT');

        let allValue = [];
        for (let ois in this.#sqloptions.insert.value) {
            allValue = allValue.concat(this.#sqloptions.insert.value[ois]);
        }
        let result = sqlite.execute(sql, allValue);
        return result;

    }

    /**
     * 更新数据
     * @param {object} data 对象数据
     */
    update(data) {
        if (!this.#sqloptions.result) return false;//拦截
        if (typeof data != 'object') {
            logger.error('Data should be an object containing column names and values!');
            return false;
        }
        for (let key in data) {
            this.#sqloptions.update.field.push(key);//设置修改的字段
            this.#sqloptions.update.bindValue.push(data[key]);//设置修改的字段
        }
        let sql = this.generateSql('UPDATE');
        let tolArr = this.#sqloptions.update.bindValue.concat(this.#sqloptions.where.bindValue);//合并条件的数组
        let result = sqlite.execute(sql, tolArr);
        return result;
    }

    /**
     * 删除指定条件的数据
     * @returns {boolean}
     */
    delete() {
        if (!this.#sqloptions.result) return false;//拦截
        let sql = this.generateSql('DELETE');
        let result = sqlite.execute(sql, this.#sqloptions.where.bindValue);
        return result;
    }


    //查询
    /**
     * 查询单个数据
     * 可以配合其它查询条件但是这会取代limit方法的内容
     */
    find() {
        if (!this.#sqloptions.result) return false;//拦截
        this.#sqloptions.limit = 1;//设置限制一条
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0);
    }

    /**
     * 查询多条数据
     * select方法查询成功返回数组[可能是空的],报错返回false
     */
    select() {
        if (!this.#sqloptions.result) return false;//拦截
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result;
    }

    /**
     * 分页查询
     * @param {Number} pages 当前页数|
     * @param {Number} limit 限制条数默认10
     * @returns {Object}
     */
    pages(pages, limit = 10) {
        if (!this.#sqloptions.result) return false;//拦截
        if (pages < 1) pages = 1;
        let fields = this.#sqloptions.field;//储存原有的
        let dataCount = this.count();
        this.#sqloptions.field = fields;//还原
        let selectSite = {
            site: 0,
            maxPage: Math.ceil(dataCount / limit)
        };
        if (selectSite.maxPage < pages) pages = selectSite.maxPage;
        pages--;//减一
        selectSite.site = pages * limit;
        let result = this.limit(selectSite.site, limit).select();
        Object.defineProperty(result, 'pages', {
            get() {
                return {
                    max: selectSite.maxPage,//最大页数
                    current: pages,//当前页数
                    limit: limit//每页限制数量
                };
            }
        });
        return result;
    }
    // 聚合查询结尾操作
    /**
     * 统计数量，参数是要统计的字段名（可选）
     * 可以配合其它查询条件但是这会取代field,limit方法的内容,报错返回false
     * @param {string} field 字段
     */
    count(field = '*') {
        if (!this.#sqloptions.result) return false;//拦截
        this.#sqloptions.limit = 1;//设置限制一条
        this.#sqloptions.field = ['COUNT(' + field + ') AS yoyo_count '];//设置字段
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0, 'yoyo_count');
    }
    /**
     * 获取最大值，参数是要统计的字段名（必须）
     * 可以配合其它查询条件但是这会取代field,limit方法的内容,报错返回false
     * @param {string} field 字段
     */
    max(field) {
        if (!this.#sqloptions.result) return false;//拦截
        if (typeof field != 'string' || field == '') {
            logger.error('Fields are mandatory!');
            return false;
        }
        this.#sqloptions.limit = 1;//设置限制一条
        this.#sqloptions.field = ['MAX(' + field + ') AS yoyo_max '];//设置字段
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0, 'yoyo_max');
    }

    /**
     * 获取最小值，参数是要统计的字段名（必须）
     * 可以配合其它查询条件但是这会取代field,limit方法的内容,报错返回false
     * @param {string} field 字段
     */
    min(field) {
        if (!this.#sqloptions.result) return false;//拦截
        if (typeof field != 'string' || field == '') {
            logger.error('Fields are mandatory!');
            return false;
        }
        this.#sqloptions.limit = 1;//设置限制一条
        this.#sqloptions.field = ['MIN(' + field + ') AS yoyo_min '];//设置字段
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0, 'yoyo_min');
    }

    /**
     * 获取平均值，参数是要统计的字段名（必须）
     * 可以配合其它查询条件但是这会取代field,limit方法的内容,报错返回false
     * @param {string} field 字段
     */
    avg(field) {
        if (!this.#sqloptions.result) return false;//拦截
        if (typeof field != 'string' || field == '') {
            logger.error('Fields are mandatory!');
            return false;
        }
        this.#sqloptions.limit = 1;//设置限制一条
        this.#sqloptions.field = ['AVG(' + field + ') AS yoyo_avg '];//设置字段
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0, 'yoyo_avg');
    }

    /**
    * 获取总分，参数是要统计的字段名（必须）
    * 可以配合其它查询条件但是这会取代field,limit方法的内容,报错返回false
    * @param {string} field 字段
    */
    sum(field) {
        if (!this.#sqloptions.result) return false;//拦截
        if (typeof field != 'string' || field == '') {
            logger.error('Fields are mandatory!');
            return false;
        }
        this.#sqloptions.limit = 1;//设置限制一条
        this.#sqloptions.field = ['SUM(' + field + ') AS yoyo_sum '];//设置字段
        let sql = this.generateSql('SELECT');
        let result = sqlite.query(sql, this.#sqloptions.where.bindValue);
        return result.get(0, 'yoyo_sum');
    }




    /* 其它方法 */

    /**
     * 生成sql语句
     * @param {string} type 类型(SELECT|INSERT|UPDATE|DELETE)
     */
    generateSql(type) {
        let resultSql = "";
        let {
            field,
            table,
            alias,
            join,
            where,
            group,
            having,
            order,
            limit,
            update,
            insert
        } = this.#sqloptions;
        //条件集合
        let wheres = '';//条件
        if (field.length > 0) {
            field = field.join(',');
        } else {
            field = '*';
        }
        if (alias != '') alias = (' ' + alias);//别名
        if (where.sql.length > 0) {
            wheres = (' WHERE ' + where.sql.join(' AND '));
        }

        if (group != '') group = (' GROUP BY ' + group);
        if (having != '') having = (' HAVING ' + having);
        if (order.length > 0) order = (' ORDER BY ' + order.join(','));
        if (limit != '') limit = (' LIMIT ' + limit);
        //类型筛选
        switch (type) {
            case 'SELECT':
                let joins = '';
                if (join.length > 0) {
                    //多表联查
                    joins = `${join[0][2]} ${join[0][0]} ON ${join[0][1]}`;
                    for (let i = 1; i < join.length; i++) {
                        joins = "(" + joins + ") " + join[i][2] + " " + join[i][0] + " ON " + join[i][1];
                    }
                    joins = ` ${joins} `;
                }
                resultSql = "SELECT " + field + " FROM " + table + alias + joins + wheres + group + having + order + limit + ";";
                break;
            case 'INSERT':
                let valueArr = [];
                let lists = insert.value;
                for (let value in lists) {
                    let bindS = lists[value].map(vs => '?');
                    valueArr.push(`(${bindS.join(',')})`);
                }
                resultSql = "INSERT INTO " + table + " (" + insert.field.join(',') + ") VALUES " + valueArr.join(',') + ";";
                break;
            case 'UPDATE':
                let updatedata = update.field.map(vf => String(vf + " = ?")).join(',');
                resultSql = `UPDATE ${table} SET ${updatedata}${wheres}${limit};`;
                break;
            case 'DELETE':
                resultSql = "DELETE FROM " + table + wheres + limit + ";";
                break;
            default:
                break;
        }
        return resultSql;
    }

    /**
     * 判断是否是二维数组
     * @param {Array} arr 数组
     * @returns {boolean}
     */
    #isTwoArray(arr) {
        for (let key in arr) {
            if (!Array.isArray(arr[key])) {
                return false;
            }
        }
        return true;
    }

    /**
     * 判断是否是数组对象
     * @param {Array} arr 数组
     * @returns {boolean}
     */
    #isArrayObj(arr) {

        for (let key in arr) {
            if (typeof arr[key] != 'object') {
                return false;
            }
        }
        return true;
    }

    /**
     * 判断是否是单纯的数组数据
     * @param {Array} arr 数组
     * @returns {boolean}
     */
    #isArrayData(arr) {
        for (let key in arr) {
            if (typeof arr[key] == 'object' || Array.isArray(arr[key])) {
                return false;
            }
        }
        return true;
    }

    /* 直接操作的静态 */

    /**
     * 原生查询(query方法用于执行SQL查询操作，返回查询结果数据集（数组）)
     * @param {string} sql 执行的
     * @param {Object} [bind] 绑定的 可选
     */
    static query(sql, bind) {
        if (sqlite.isShowSql) {
            logSql(sql, bind);
        }
        let DBStmt = sqlite.link.prepare(sql);
        if (typeof bind != 'undefined') DBStmt.bind(bind);
        DBStmt.execute();
        let resultArr = [];
        DBStmt.fetchAll(object => resultArr.push(object));
        let resultData = {};
        Object.defineProperty(resultData, 'data', {
            get() {
                return (resultArr == null || resultArr.length < 1) ? [] : resultArr;//数据
            }
        });
        Object.defineProperty(resultData, 'field', {
            get() {
                return (resultArr == null || resultArr.length < 1) ? [] : Object.keys(resultArr[0]);//字段
            }
        });
        Object.defineProperty(resultData, 'total', {
            get() {
                return resultData.data.length;//数据总数
            }
        });
        resultData.get = (index, field = null) => {
            if (typeof index != 'number') return null;//参数错误
            if (field != null) {
                if (typeof field != 'string' || field == '') return null;//参数错误
                let fieldIndex = resultData.field.indexOf(field);
                if (fieldIndex === -1) return null;//找不到指定字段
                index = parseInt(index);
                if ((resultData.data.length - 1) < index) return null;//没有这个条数据
                return resultData.data[index][field];//返回指定数据
            }
            return resultData.data[index];//返回指定索引数据

        };
        return resultData;
    }

    /**
    * 原生执行(用于更新和写入数据的sql操作，如果数据非法或者查询错误则返回0，否则返回受影响条数(不管是否有影响))
    * @param {string} sql 执行的
    * @param {Object} [bind] 绑定的
    */
    static execute(sql, bind) {
        if (sqlite.isShowSql) {
            logSql(sql, bind);
        }
        let DBStmt = sqlite.link.prepare(sql);
        DBStmt.bind(bind).execute();
        return DBStmt.affectedRows < 1 ? 0 : { insertId: DBStmt.insertId, affectedRows: DBStmt.affectedRows };
    }






}


/**
     * 打印sql
     * @param {String} sql 
     * @param {Array|any} bind 绑定的值
     */
function logSql(sql, bind) {
    let logSql = sql;
    if (!Array.isArray(bind)) {
        bind = [bind];
    }
    let newBind = bind.concat();
    for (let k in newBind) {
        if (typeof newBind[k] === 'string' || typeof newBind[k] === 'boolean') {
            newBind[k] = `'${newBind[k]}'`;
        }
        logSql = logSql.replace(/([\s\=])?\?(\s)?/, '$1' + newBind[k] + '$2');
    }
    log('sqlite: ' + logSql);//打印输出
}

module.exports = {
    sqlite
};
