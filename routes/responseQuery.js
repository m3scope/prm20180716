const loadUser = require("../libs/loadUser");
const Userr = require('../models/user');
const config = require('config');
const amd = config.get('amd');
const sndSms = require('../libs/sndSms');

const Query = require('../models/query');
const Deal = require('../models/deal');
const Bill = require('../models/bill');
const db_bills = require('../libs/db_bills');
const Bank = require('../models/bank');
const TransactionQuery = require('../models/transactionQuery');

const QRCode = require('qrcode');

const Curr = {
    'RUR' : [3,'/deals/1;3','/deals/2;3'],
    'USD' : [2,'/deals/1;2','','/deals/2;3'],
    'PZM' : [1,'','/deals/1;2','/deals/1;3']
};

exports.get = function (req, res, next) {
    console.log('************** QUERY *********');
    if(!req.session.user){
        res.redirect('/login');
    } else {
        if(req.params.id) {
            let params = req.params.id.split(';');
            let UserBalance = [0,0,0,0,0];
            let LoginRegister = '<b><a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ВВОД / ВЫВОД</label></a>&nbsp;&nbsp;<a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ПРОФИЛЬ</label></a>&nbsp;&nbsp;<a href="/logout">ВЫХОД</a></b>';
            loadUser.findID(req.session.user, function (err, user) {
                if(err) res.status(500).send('Внутренняя ошибка!');
                if(!user){
                    req.session.destroy();
                    res.redirect('/login');
                } else {
                    UserBalance = [0,Math.round(user.PZM*100)/100,Math.round(user.USD*100)/100,Math.round(user.RUR*100)/100];
                    //console.log(user.prizmaddress);
                    LoginRegister = '<div class="w3-right-align w3-small"><span class="w3-border-top">'+req.session.username+'</span></div><a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ВВОД / ВЫВОД</label></a>&nbsp;&nbsp;<a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ПРОФИЛЬ</label></a>&nbsp;&nbsp;<a href="/logout" class="w3-button w3-border w3-border-white w3-round">ВЫХОД</a>' +
                        '<div class="w3-right-align w3-small">' +
                        '<span>PZM: </span>' +
                        '<label class="w3-border-bottom"> '+UserBalance[1]+' </label>' +
                        '<span>&nbsp; RUR: </span>' +
                        '<label class="w3-border-bottom"> '+UserBalance[3]+' </label>' +
                        '<span>&nbsp; USD: </span>' +
                        '<label class="w3-border-bottom"> '+UserBalance[2]+' </label></div>';

                    switch (params[1]) {
                        case 'confirm':
                            Query.findOne({_id: params[0], userId: user._id, status:0}, function (err, qq) {
                                if (err) console.error(err);
                                if (qq) {
                                    //console.log(qq);
                                    //if (qq.class == 1) {
                                        res.render('responsequery', {
                                            qq: qq,
                                            title: 'Подтвердить ЗАПРОС',
                                            user: user,
                                            LoginRegister: LoginRegister
                                        });
                                    // } else {
                                    //     res.render('info', {
                                    //         infoTitle: '<div class="w3-green">Успех!</div>',
                                    //         infoText: 'Проверьте свою почту и перейдите по ссылке! (ПРОВЕРЬТЕ ПАПКУ СПАМ!!!)',
                                    //         url: '/profile',
                                    //         title: 'Подтверждение запроса!',
                                    //         user: {},
                                    //         LoginRegister: '<b></b>'
                                    //     });
                                    // }
                                } else {
                                    //res.redirect('/logout');
                                    res.render('info', {
                                        infoTitle: '<div class="w3-red">Ошибка!</div>',
                                        infoText: 'Запрос не найден',
                                        url: '/profile',
                                        title: 'Не найден',
                                        user: user,
                                        LoginRegister: LoginRegister
                                    });
                                }

                            });
                            break;
                        case 'cancel':
                            Query.findOne({_id: params[0], userId: user._id}, function (err, qq) {
                                if (err) console.error(err);
                                if (qq) {
                                    //console.log(qq);
                                    if (qq.class == 0) {    //Вывод средств
                                        if (qq.status == 0) {
                                            qq.status = 4;
                                            qq.dateCancel = Date.now();
                                            user[qq.currency_name] = Number(user[qq.currency_name]) + Number(qq.amount);
                                            user.save();
                                            Bank.findById(qq.bankId, function (err, bank) {
                                                if (err) {
                                                    console.error(err);
                                                } else {
                                                    if (bank) {
                                                        //********** BANK *******
                                                        bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                        bank.summ_all_current = Number(bank.summ_all_current) + Number(qq.amount) - Number(qq.commission_summ);

                                                        bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                        bank.summ_all = Number(bank.summ_all)-Number(qq.amount);

                                                        bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                        bank.summ_all_day = Number(bank.summ_all_day) + Number(qq.amount);


                                                        bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                        bank.summ_all_month = Number(bank.summ_all_month) + Number(qq.amount);

                                                        // bank.summ_transactions =Number( bank.summ_transactions)+Number(qq.amount);
                                                        // bank.summ_all = Number(bank.summ_all)+Number(qq.amount);
                                                        bank.rounds = Number(bank.rounds) + 4 + Number(qq.amount);

                                                        bank.save();
                                                        //---------------------
                                                    }
                                                }
                                            });
                                            qq.save();
                                            res.render('info', {
                                                infoTitle: '<div class="w3-green">Успех!</div>',
                                                infoText: 'Операция успешно выполнена!',
                                                url: '/profile',
                                                title: 'Запрос отменен...',
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                        } else {
                                            res.redirect('/logout');
                                        }
                                    } else {    // отмена пополнения
                                        if (qq.status < 3) {
                                            qq.status = 4;
                                            qq.dateCancel = Date.now();
                                            Bank.findById(qq.bankId, function (err, bank) {
                                                if (err) {
                                                    console.error(err);
                                                } else {
                                                    if (bank) {
                                                        //********** BANK *******
                                                        bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                        //bank.summ_all_current = Number(bank.summ_all_current) - Number(qq.amount);

                                                        //bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                        bank.summ_all = Number(bank.summ_all)+Number(qq.amount);

                                                        bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                        bank.summ_all_day = Number(bank.summ_all_day) - Number(qq.amount);


                                                        bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                        bank.summ_all_month = Number(bank.summ_all_month) - Number(qq.amount);

                                                        // bank.summ_transactions =Number( bank.summ_transactions)-Number(qq.amount);

                                                        // bank.summ_all = Number(bank.summ_all)-Number(qq.amount);
                                                        bank.rounds = Number(bank.rounds) - 18;
                                                        bank.save();
                                                        //---------------------
                                                    }
                                                }
                                            });
                                            qq.save();

                                            res.render('info', {
                                                infoTitle: '<div class="w3-green">Успех!</div>',
                                                infoText: 'Операция успешно выполнена!',
                                                url: '/profile',
                                                title: 'Запрос отменен...',
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                        } else {
                                            res.redirect('/logout');
                                        }
                                    }

                                } else {
                                    res.redirect('/logout');
                                }
                            });
                            break;
                        case 'cancelamd':
                            if(amd.indexOf(req.session.user) > -1) {
                                Query.findOne({_id: params[0]}, function (err, qq) {
                                    if (err) console.error(err);
                                    if (qq) {
                                        //console.log(qq);
                                        if (qq.status < 3) {
                                            res.render('amd_index', {
                                                inc: {f: 'q_cancelAmd'},
                                                title: 'Отменить ЗАПРОС',
                                                qq: qq,
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                        } else {
                                            res.render('info', {
                                                infoTitle: '<div class="w3-red">Ошибка!</div>',
                                                infoText: 'Операция не выполнена!',
                                                url: '/amd/querys',
                                                title: 'Статус запроса не поддерживается!',
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                            //res.redirect('/logout');
                                        }
                                    } else {
                                        res.render('info', {
                                            infoTitle: '<div class="w3-red">Ошибка!</div>',
                                            infoText: 'Операция не выполнена!',
                                            url: '/amd/querys',
                                            title: 'Запрос удален!',
                                            user: user,
                                            LoginRegister: LoginRegister
                                        });
                                        //res.redirect('/logout');
                                    }
                                });
                            } else {
                                res.redirect('/logout');
                            }
                            break;
                        case 'execut':
                            // ********** execut   // добавление на счет
                            if(amd.indexOf(req.session.user) > -1) {
                                Query.findOne({_id: params[0]}, function (err, qq) {
                                    if (err) console.error(err);
                                    if (qq) {
                                        //console.log(qq);
                                        if (qq.status == 1) {
                                            res.render('amd_index', {
                                                inc: {f: 'q_execut'},
                                                title: 'Подтвердить ЗАПРОС',
                                                qq: qq,
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                        } else {
                                            res.render('info', {
                                                infoTitle: '<div class="w3-red">Ошибка!</div>',
                                                infoText: 'Операция не выполнена!',
                                                url: '/profile',
                                                title: 'Статус запроса не поддерживается!',
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                            //res.redirect('/logout');
                                        }
                                    } else {
                                        res.render('info', {
                                            infoTitle: '<div class="w3-red">Ошибка!</div>',
                                            infoText: 'Операция не выполнена!',
                                            url: '/profile',
                                            title: 'Запрос удален!',
                                            user: user,
                                            LoginRegister: LoginRegister
                                        });
                                        //res.redirect('/logout');
                                    }
                                });
                            } else {
                                res.redirect('/logout');
                            }
                            break;

                        case 'cancelexec':
                            if(amd.indexOf(req.session.user) > -1) {        // req.session.user (user._id)
                                Query.findOne({_id: params[0]}, function (err, qq) {
                                    if (err) console.error(err);
                                    if (qq) {
                                        //console.log(qq);
                                        if (Number(qq.status) == 3) {
                                            if (qq.class == 0) {    // отмена вывод средств
                                                qq.status = 5;
                                                qq.dateCancel = Date.now();
                                                Userr.findOne({_id:qq.userId}).exec(function (err, usrr) {
                                                    if(usrr){
                                                        usrr[qq.currency_name] = Number(usrr[qq.currency_name]) + Number(qq.amount);
                                                        usrr.save();
                                                    }
                                                });
                                                Bank.findById(qq.bankId, function (err, bank) {
                                                    if (err) {
                                                        console.error(err);
                                                    } else {
                                                        if (bank) {
                                                            //********** BANK *******
                                                            bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                            bank.summ_all_current = Number(bank.summ_all_current) + Number(qq.amount) - Number(qq.commission_summ);

                                                            bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                            bank.summ_all = Number(bank.summ_all)-Number(qq.amount);

                                                            bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                            bank.summ_all_day = Number(bank.summ_all_day) + Number(qq.amount);


                                                            bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                            bank.summ_all_month = Number(bank.summ_all_month) + Number(qq.amount);

                                                            // bank.summ_transactions =Number( bank.summ_transactions)+Number(qq.amount);
                                                            // bank.summ_all = Number(bank.summ_all)+Number(qq.amount);
                                                            //bank.rounds = Number(bank.rounds) + 4;
                                                            bank.rounds = Number(bank.rounds) + 4 + Number(qq.amount);
                                                            bank.save();
                                                            //---------------------
                                                        }
                                                    }
                                                });
                                            } else {            // Отмена Пополнение баланса
                                                qq.status = 5;
                                                qq.dateCancel = Date.now();
                                                Bank.findById(qq.bankId, function (err, bank) {
                                                    if (err) {
                                                        console.error(err);
                                                    } else {
                                                        if (bank) {
                                                            //********** BANK *******
                                                            bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                            //bank.summ_all_current = Number(bank.summ_all_current) - Number(qq.amount);

                                                            //bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                            bank.summ_all = Number(bank.summ_all)+Number(qq.amount);

                                                            bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                            bank.summ_all_day = Number(bank.summ_all_day) - Number(qq.amount);


                                                            bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                            bank.summ_all_month = Number(bank.summ_all_month) - Number(qq.amount);

                                                            // bank.summ_transactions =Number( bank.summ_transactions)+Number(qq.amount);
                                                            // bank.summ_all = Number(bank.summ_all)+Number(qq.amount);
                                                            bank.rounds = Number(bank.rounds) - 18;
                                                            bank.save();
                                                            //---------------------
                                                        }
                                                    }
                                                });
                                            }
                                            qq.save();
                                            res.render('info', {
                                                infoTitle: '<div class="w3-green">Успех!</div>',
                                                infoText: 'Операция успешно выполнена!',
                                                url: '/profile',
                                                title: 'Запрос отменен...',
                                                user: user,
                                                LoginRegister: LoginRegister
                                            });
                                        } else {
                                            res.redirect('/logout');
                                        }
                                    } else {
                                        res.redirect('/logout');
                                    }
                                });
                            } else {
                                res.redirect('/logout');
                            }
                            break;
                        default:
                    }
                }
            });
        } else {
            res.redirect('/');
        }
    }
};

exports.post = function (req, res, next) {
    console.log('************** QUERY *********');
    let params = req.params.id.split(';');
    let UserBalance = [0,0,0,0,0];
    let LoginRegister = '<b><a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ВВОД / ВЫВОД</label></a>&nbsp;&nbsp;<a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ПРОФИЛЬ</label></a>&nbsp;&nbsp;<a href="/logout">ВЫХОД</a></b>';
    loadUser.findID(req.session.user, function (err, user) {
        if(err) res.status(500).send('Внутренняя ошибка!');
        if(!user){
            req.session.destroy();
            res.redirect('/login');
        } else {
            UserBalance = [0,Math.round(user.PZM*100)/100,Math.round(user.USD*100)/100,Math.round(user.RUR*100)/100];
            LoginRegister = '<div class="w3-right-align w3-small"><span class="w3-border-top">'+req.session.username+'</span></div><a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ВВОД / ВЫВОД</label></a>&nbsp;&nbsp;<a href="/profile" class="w3-button w3-border w3-border-white w3-round"><label>ПРОФИЛЬ</label></a>&nbsp;&nbsp;<a href="/logout" class="w3-button w3-border w3-border-white w3-round">ВЫХОД</a>' +
                '<div class="w3-right-align w3-small">' +
                '<span>PZM: </span>' +
                '<label class="w3-border-bottom"> '+UserBalance[1]+' </label>' +
                '<span>&nbsp; RUR: </span>' +
                '<label class="w3-border-bottom"> '+UserBalance[3]+' </label>' +
                '<span>&nbsp; USD: </span>' +
                '<label class="w3-border-bottom"> '+UserBalance[2]+' </label></div>';
            switch (params[1]){
                case 'confirm':
                    Query.findOne({_id:params[0], userId:user._id}, function (err, qq) {
                        if(err) console.error(err);
                        if(qq){
                            //console.log(qq);
                            if(qq.status == 0){
                                if(qq.class == 1) {
                                    //     sndSms(qq.dealerId,'Отпр. '+qq.bank_name +' '+Math.round((qq.amount-qq.commission_summ)*100)/100 + ' '+qq.currency_name);
                                    // } else {
                                    if (qq.bank_cod == 0 || qq.bank_cod > 3) {
                                        sndSms(qq.dealerId, 'прием ' + qq.bank_name + ' ' + Math.round((qq.amount) * 100) / 100 + ' ' + qq.currency_name);
                                    }
                                    qq.status = 1;
                                    qq.save();
                                    res.render('info', {
                                        infoTitle: '<div class="w3-green">Успех!</div>',
                                        infoText: 'Операция успешно выполнена!',
                                        url: '/profile',
                                        title: 'Запрос подтвержден',
                                        user: user,
                                        LoginRegister: LoginRegister
                                    });
                                } else {
                                    //res.redirect('/logout');

                                        sndSms(qq.dealerId, 'Отправка ' + qq.bank_name + ' ' + Math.round((qq.amount) * 100) / 100 + ' ' + qq.currency_name);

                                    qq.status = 1;
                                    qq.save();
                                    res.render('info', {
                                        infoTitle: '<div class="w3-green">Успех!</div>',
                                        infoText: 'Операция успешно выполнена!',
                                        url: '/profile',
                                        title: 'Запрос подтвержден',
                                        user: user,
                                        LoginRegister: LoginRegister
                                    });
                                }
                            } else {
                                res.redirect('/logout');
                            }
                        } else {
                            res.redirect('/logout');
                        }

                    });
                    break;
                case 'cancel':

                    Query.findOne({_id:params[0], userId:user._id, status: 0}, function (err, qq) {
                        if(err) console.error(err);
                        if(qq){
                            //console.log(qq);
                            if(Number(qq.status) < 1){
                                qq.status = 4;
                                if(Number(qq.class) < 1){   // Вывод средств
                                    user[qq.currency_name] = Number(user[qq.currency_name])+Number(qq.amount);
                                    user.save();
                                }
                                qq.save();
                                res.render('info', {infoTitle: '<div class="w3-green">Успех!</div>', infoText: 'Операция успешно выполнена!', url: '/profile', title: 'Запрос подтвержден', user: user, LoginRegister: LoginRegister});
                            } else {
                                res.redirect('/logout');
                            }
                        } else {
                            // res.redirect('/logout');
                            res.render('info', {
                                infoTitle: '<div class="w3-red">Ошибка!</div>',
                                infoText: 'Операция не выполнена!',
                                url: '/profile',
                                title: 'Запрос удален!',
                                user: user,
                                LoginRegister: LoginRegister
                            });
                        }
                    });
                    break;
                case 'cancelamd':
                    if(amd.indexOf(req.session.user) > -1){
                        Query.findOne({_id:params[0]}, function (err, qq) {
                            if(err) console.error(err);
                            if(qq){
                                //console.log(qq);
                                if(qq.status < 3){
                                    if(Number(qq.class) < 1){   //отмена вывода средств
                                        qq.status = 5;
                                        qq.dateCancel = Date.now();
                                        qq.comments = qq.comments + ' / '+req.body.comments;
                                        Userr.findOne({_id:qq.userId}).exec(function (err, usrr) {
                                            if(usrr){
                                                if(!req.body.no_balance) {
                                                    usrr[qq.currency_name] = Number(usrr[qq.currency_name]) + Number(qq.amount);
                                                    usrr.save();
                                                }
                                            }
                                        });
                                        Bank.findById(qq.bankId, function (err, bank) {
                                            if (err) {
                                                console.error(err);
                                            } else {
                                                if (bank) {
                                                    //********** BANK *******
                                                    bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                    bank.summ_all_current = Number(bank.summ_all_current) + Number(qq.amount) - Number(qq.commission_summ);

                                                    bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                    bank.summ_all = Number(bank.summ_all)-Number(qq.amount);

                                                    bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                    bank.summ_all_day = Number(bank.summ_all_day) + Number(qq.amount);


                                                    bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                    bank.summ_all_month = Number(bank.summ_all_month) + Number(qq.amount);

                                                    // bank.summ_transactions =Number( bank.summ_transactions)+Number(qq.amount);
                                                    // bank.summ_all = Number(bank.summ_all)+Number(qq.amount);
                                                    //bank.rounds = Number(bank.rounds) + 4;
                                                    bank.rounds = Number(bank.rounds) + 4 + Number(qq.amount);
                                                    bank.save();
                                                    //---------------------
                                                }
                                            }
                                        });
                                    } else {        // ОТМЕНА ПОПОЛНЕНИЯ БАЛАНСА
                                        qq.status = 5;
                                        qq.dateCancel = Date.now();
                                        qq.comments = qq.comments + ' / '+req.body.comments;
                                        Bank.findById(qq.bankId, function (err, bank) {
                                            if (err) {
                                                console.error(err);
                                            } else {
                                                if (bank) {
                                                    //********** BANK *******
                                                    bank.summ_trans_current = Number(bank.summ_trans_current) - Number(qq.amount);
                                                    //bank.summ_all_current = Number(bank.summ_all_current) - Number(qq.amount);

                                                    //bank.summ_transactions = Number(bank.summ_trans_current)-Number(qq.amount);
                                                    bank.summ_all = Number(bank.summ_all)+Number(qq.amount);

                                                    //bank.summ_trans_day = Number(bank.summ_trans_day) - Number(qq.amount);
                                                    bank.summ_all_day = Number(bank.summ_all_day) - Number(qq.amount);


                                                    //bank.summ_trans_month = Number(bank.summ_trans_month) - Number(qq.amount);
                                                    bank.summ_all_month = Number(bank.summ_all_month) - Number(qq.amount);

                                                    // bank.summ_transactions =Number( bank.summ_transactions)+Number(qq.amount);
                                                    // bank.summ_all = Number(bank.summ_all)+Number(qq.amount);
                                                    bank.rounds = Number(bank.rounds) - 18;
                                                    bank.save();
                                                    //---------------------
                                                }
                                            }
                                        });
                                    }
                                    qq.save();
                                    res.render('info', {
                                        infoTitle: '<div class="w3-green">Успех!</div>',
                                        infoText: 'Операция успешно выполнена!',
                                        url: '/amd/querys',
                                        title: 'Запрос отменен Администратором',
                                        user: user,
                                        LoginRegister: LoginRegister
                                    });
                                } else {
                                    res.redirect('/logout');
                                }
                            } else {
                                res.redirect('/logout');
                            }
                        });
                    } else {
                        res.redirect('/logout');
                    }

                    break;
                case 'execut':
                    // ********** execut   // добавление на счет
                    if(amd.indexOf(req.session.user) > -1) {
                        Query.findOne({_id: params[0]}, function (err, qq) {
                            if (err) console.error(err);
                            if (qq) {
                                //console.log(qq);
                                if (qq.status == 1) {
                                    qq.status = 3;
                                    qq.dateExec = Date.now();
                                    qq.comments = qq.comments + ' / '+req.body.comments;
                                    if(req.body.bank_commission_tax > 0) qq.bank_commission_tax = req.body.bank_commission_tax;
                                    if(req.body.bank_commission_summ > 0) qq.bank_commission_summ = req.body.bank_commission_summ;
                                    qq.save(function (err, qqsaved) {
                                        if (err) {
                                            console.error(err);
                                            res.redirect('/logout');
                                        } else {
                                            Userr.findById(qqsaved.userId, function (err, userr) {
                                                if (err) {
                                                    console.error(err);
                                                    res.render('info', {
                                                        infoTitle: '<div class="w3-red">Ошибка!</div>',
                                                        infoText: 'User not found! UID: ' + qqsaved.UID,
                                                        url: '/profile',
                                                        title: 'Запрос подтвержден',
                                                        user: user,
                                                        LoginRegister: LoginRegister
                                                    });
                                                } else {
                                                    if (userr) {
                                                        if (qqsaved.class == 1) {     // пополнение баланса
                                                            Bank.findById(qqsaved.bankId, function (err, bank) {
                                                                if (err) {
                                                                    console.error(err);
                                                                } else {
                                                                    if (bank) {
                                                                        //********** BANK *******
                                                                        bank.summ_all_current = Number(bank.summ_all_current) + Number(qqsaved.amount);
                                                                        bank.rounds = Number(bank.rounds) + Number(qqsaved.amount);

                                                                        bank.save();
                                                                        //---------------------
                                                                    }
                                                                }
                                                            });
                                                            userr[qqsaved.currency_name] = Number(userr[qqsaved.currency_name]) + Number(qqsaved.amount) - Number(qqsaved.commission_summ);
                                                            userr.save();
                                                            //******** СПИСАНИЕ КОМИССИИ
                                                            let newTrans3 = new TransactionQuery;
                                                            newTrans3.sort = 3;
                                                            newTrans3.sortName = 'списание комиссии';
                                                            newTrans3.queryId = qqsaved._id;
                                                            newTrans3.userId = qqsaved.userId;
                                                            newTrans3.currency = qqsaved.currency;
                                                            newTrans3.amount = qqsaved.commission_summ;
                                                            newTrans3.up_down = true;
                                                            newTrans3.save();
                                                        } else {
                                                            //**************** Списание ДОП. Комиссии ***********
                                                            Bank.findById(qqsaved.bankId, function (err, bank) {
                                                                if (err) {
                                                                    console.error(err);
                                                                } else {
                                                                    if (bank) {
                                                                        //********** BANK *******
                                                                        bank.summ_all_current = Number(bank.summ_all_current) - Number(qq.bank_commission_summ);
                                                                        //bank.rounds = Number(bank.rounds) + Number(qqsaved.amount);

                                                                        bank.save();
                                                                        //---------------------
                                                                    }
                                                                }
                                                            });
                                                            //******** СПИСАНИЕ КОМИССИИ
                                                            let newTrans3 = new TransactionQuery;
                                                            newTrans3.sort = 3;
                                                            newTrans3.sortName = 'списание комиссии';
                                                            newTrans3.queryId = qqsaved._id;
                                                            newTrans3.userId = qqsaved.userId;
                                                            newTrans3.currency = qqsaved.currency;
                                                            newTrans3.amount = qqsaved.commission_summ;
                                                            newTrans3.up_down = false;
                                                            newTrans3.save();
                                                        }
                                                        res.render('info', {
                                                            infoTitle: '<div class="w3-green">Успех!</div>',
                                                            infoText: 'Операция успешно выполнена!',
                                                            url: '/amd/querys',
                                                            title: 'Запрос подтвержден',
                                                            user: user,
                                                            LoginRegister: LoginRegister
                                                        });
                                                    } else {
                                                        console.error('User not found: ' + qqsaved.UID);
                                                        res.render('info', {
                                                            infoTitle: '<div class="w3-red">Ошибка!</div>',
                                                            infoText: 'User not found! UID: ' + qqsaved.UID,
                                                            url: '/amd/querys',
                                                            title: 'Запрос подтвержден',
                                                            user: user,
                                                            LoginRegister: LoginRegister
                                                        });
                                                    }
                                                }
                                            });
                                            //res.render('info', {infoTitle: '<div class="w3-green">Успех!</div>', infoText: 'Операция успешно выполнена!', url: '/profile', title: 'Запрос подтвержден', user: user, LoginRegister: LoginRegister});
                                        }

                                    });
                                    //res.render('info', {infoTitle: '<div class="w3-green">Успех!</div>', infoText: 'Операция успешно выполнена!', url: '/profile', title: 'Запрос подтвержден', user: user, LoginRegister: LoginRegister});
                                } else {
                                    res.render('info', {
                                        infoTitle: '<div class="w3-red">Ошибка!</div>',
                                        infoText: 'Операция не выполнена!',
                                        url: '/profile',
                                        title: 'Статус запроса не поддерживается!',
                                        user: user,
                                        LoginRegister: LoginRegister
                                    });
                                    //res.redirect('/logout');
                                }
                            } else {
                                res.render('info', {
                                    infoTitle: '<div class="w3-red">Ошибка!</div>',
                                    infoText: 'Операция не выполнена!',
                                    url: '/profile',
                                    title: 'Запрос удален!',
                                    user: user,
                                    LoginRegister: LoginRegister
                                });
                                //res.redirect('/logout');
                            }
                        });
                    } else {
                        res.redirect('/logout');
                    }
                    break;
                case 'canclexec':

                    break;
                default:
            }
    }
});
};